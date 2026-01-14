import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { sessionsAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/useWebSocket";
import { PauseSessionDialog } from "@/components/PauseSessionDialog";
import { ResumeSessionDialog } from "@/components/ResumeSessionDialog";
import { WinnerSelectionDialog } from "@/components/WinnerSelectionDialog";
import { 
  Clock, 
  User, 
  Phone, 
  Pause, 
  Play, 
  RefreshCw, 
  LogOut,
  Coffee,
  CheckCircle,
  XCircle,
  Trophy,
  Users
} from "lucide-react";
import { formatDuration, formatCurrency } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { useConfirmation } from "@/components/ui/confirmation-dialog";

export default function AdminSessions() {
  const { toast } = useToast();
  const { confirm, ConfirmationDialog } = useConfirmation();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
  const [resumeDialogOpen, setResumeDialogOpen] = useState(false);
  const [winnerDialogOpen, setWinnerDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [timerData, setTimerData] = useState<Record<string, { elapsed: number; remaining: number }>>({});

  const { on, isConnected } = useWebSocket({ namespace: 'admin' });

  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isConnected) return;

    const handleSessionPaused = (data: any) => {
      setSessions(prevSessions => 
        prevSessions.map(s => {
          if (s.id === data.session_id) {
            return {
              ...s,
              status: 'paused',
              currentPauseStart: data.currentPauseStart ? new Date(data.currentPauseStart) : undefined,
              pauseHistory: data.pauseHistory || s.pauseHistory || [],
            };
          }
          return s;
        })
      );
    };

    const handleSessionResumed = (data: any) => {
      setSessions(prevSessions => 
        prevSessions.map(s => {
          if (s.id === data.session_id) {
            return {
              ...s,
              status: 'active',
              endTime: data.endTime ? new Date(data.endTime) : s.endTime,
              currentPauseStart: undefined,
              totalPausedDuration: data.totalPausedDuration || s.totalPausedDuration || 0,
              pauseHistory: (data.pauseHistory || s.pauseHistory || []).map((p: any) => ({
                ...p,
                startTime: new Date(p.startTime),
                endTime: p.endTime ? new Date(p.endTime) : undefined,
              })),
            };
          }
          return s;
        })
      );
    };

    const handleTimerUpdate = (data: any) => {
      setTimerData(prev => ({
        ...prev,
        [data.session_id]: {
          elapsed: data.elapsed_seconds || 0,
          remaining: data.remaining_seconds || 0,
        },
      }));

      if (data.new_end_time) {
        setSessions(prevSessions => 
          prevSessions.map(s => {
            if (s.id === data.session_id) {
              return {
                ...s,
                endTime: new Date(data.new_end_time),
              };
            }
            return s;
          })
        );
      }
    };

    const handleChallengeSessionEnded = (data: any) => {
      setSessions(prevSessions => 
        prevSessions.map(s => {
          if (s.id === data.session_id) {
            return {
              ...s,
              status: 'ended',
            };
          }
          return s;
        })
      );
    };

    const handleSessionEnded = (data: any) => {
      setSessions(prevSessions => 
        prevSessions.map(s => {
          if (s.id === data.session_id) {
            return {
              ...s,
              status: 'ended',
              finalAmount: data.finalAmount || s.finalAmount,
              totalAmount: data.totalAmount || s.totalAmount,
              totalPausedDuration: data.totalPausedDuration || s.totalPausedDuration,
              actualEndTime: data.actualEndTime ? new Date(data.actualEndTime) : s.actualEndTime,
            };
          }
          return s;
        })
      );
      setTimeout(() => {
        loadSessions();
      }, 500);
      toast({
        title: 'Session Ended',
        description: `Session has been ended. Final amount: ₹${data.finalAmount || 0}`,
      });
    };

    const handleWinnerSelected = (data: any) => {
      setSessions(prevSessions => 
        prevSessions.map(s => {
          if (s.id === data.session_id && s.isChallengeSession && s.challengeData) {
            return {
              ...s,
              challengeData: {
                ...s.challengeData,
                winner: data.winner,
                winnerSelectedBy: data.selectedBy || 'players',
                winnerSelectedAt: new Date(),
                players: s.challengeData.players.map((p: any) => ({
                  ...p,
                  isWinner: p.name === data.winner,
                })),
              },
            };
          }
          return s;
        })
      );
    };

    const cleanupPaused = on('session_paused', handleSessionPaused);
    const cleanupResumed = on('session_resumed', handleSessionResumed);
    const cleanupTimer = on('timer_update', handleTimerUpdate);
    const cleanupChallengeEnded = on('challenge_session_ended', handleChallengeSessionEnded);
    const cleanupSessionEnded = on('session_ended', handleSessionEnded);
    const cleanupWinnerSelected = on('winner_selected', handleWinnerSelected);

    return () => {
      cleanupPaused();
      cleanupResumed();
      cleanupTimer();
      cleanupChallengeEnded();
      cleanupSessionEnded();
      cleanupWinnerSelected();
    };
  }, [isConnected, on]);

  const loadSessions = async () => {
    try {
      const activeSessions = await sessionsAPI.getActive();
      const processed = activeSessions.map((s: any) => ({
        ...s,
        startTime: new Date(s.startTime),
        endTime: new Date(s.endTime),
        currentPauseStart: s.currentPauseStart ? new Date(s.currentPauseStart) : undefined,
        pauseHistory: (s.pauseHistory || []).map((p: any) => ({
          ...p,
          startTime: new Date(p.startTime),
          endTime: p.endTime ? new Date(p.endTime) : undefined,
        })),
      }));
      setSessions(processed);
    } catch (error: any) {
      console.error('Failed to load sessions:', error);
      toast({
        title: "Error",
        description: "Failed to load sessions.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async (sessionId: string, reason?: string) => {
    setActionLoading(sessionId);
    try {
      await sessionsAPI.pause(sessionId, reason, 'admin');
      toast({
        title: "Session Paused",
        description: "The session has been paused successfully.",
      });
      await loadSessions();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to pause session.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async (sessionId: string) => {
    setActionLoading(sessionId);
    try {
      await sessionsAPI.resume(sessionId, 'admin');
      toast({
        title: "Session Resumed",
        description: "The session has been resumed successfully.",
      });
      await loadSessions();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to resume session.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setActionLoading(null);
    }
  };

  const handleEndSession = async (sessionId: string) => {
    confirm({
      title: "End Session?",
      description: "Are you sure you want to end this session? This action cannot be undone.",
      variant: "destructive",
      confirmText: "End Session",
      cancelText: "Cancel",
      onConfirm: async () => {
        setActionLoading(sessionId);
        try {
          await sessionsAPI.end(sessionId);
          toast({
            title: "Session Ended",
            description: "The session has been ended successfully.",
          });
          await loadSessions();
        } catch (error: any) {
          toast({
            title: "Error",
            description: error.message || "Failed to end session.",
            variant: "destructive",
          });
          throw error;
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  const getElapsedTime = (session: any) => {
    if (timerData[session.id]) {
      return Math.floor(timerData[session.id].elapsed / 60);
    }

    if (session.status === 'paused' && session.currentPauseStart) {
      const pauseStart = new Date(session.currentPauseStart).getTime();
      const elapsedUntilPause = pauseStart - new Date(session.startTime).getTime();
      return Math.floor(elapsedUntilPause / (1000 * 60));
    }
    const now = Date.now();
    const start = new Date(session.startTime).getTime();
    const paused = session.totalPausedDuration || 0;
    const elapsed = Math.floor((now - start) / (1000 * 60)) - paused;
    return Math.max(0, elapsed);
  };

  const getRemainingTime = (session: any) => {
    if (timerData[session.id]) {
      return Math.floor(timerData[session.id].remaining / 60);
    }

    if (session.status === 'paused') {
      const end = new Date(session.endTime).getTime();
      const start = new Date(session.startTime).getTime();
      const paused = session.totalPausedDuration || 0;
      const total = Math.floor((end - start) / (1000 * 60)) - paused;
      const elapsed = getElapsedTime(session);
      return Math.max(0, total - elapsed);
    }
    const now = Date.now();
    const end = new Date(session.endTime).getTime();
    return Math.max(0, Math.floor((end - now) / (1000 * 60)));
  };

  const getPausedDuration = (session: any) => {
    if (session.status === 'paused' && session.currentPauseStart) {
      const pauseStart = new Date(session.currentPauseStart).getTime();
      const now = Date.now();
      const currentPause = Math.floor((now - pauseStart) / (1000 * 60));
      return (session.totalPausedDuration || 0) + currentPause;
    }
    return session.totalPausedDuration || 0;
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Session Management</h1>
            <p className="text-muted-foreground mt-1">
              Manage all active gaming sessions
            </p>
          </div>
          <Button
            variant="outline"
            onClick={loadSessions}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {sessions.length === 0 ? (
          <Card className="glass text-center py-12">
            <CardContent>
              <p className="text-muted-foreground">No active sessions found.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sessions.map((session) => {
              const isPaused = session.status === 'paused';
              const elapsed = getElapsedTime(session);
              const remaining = getRemainingTime(session);
              const pausedDuration = getPausedDuration(session);
              const isLoading = actionLoading === session.id;

              return (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className={`glass-ios ${isPaused ? 'border-warning/50' : 'border-primary/20'}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            {session.activityId?.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Activity'}
                            {isPaused && (
                              <Badge variant="outline" className="bg-warning/20 text-warning border-warning/50">
                                <Pause className="w-3 h-3 mr-1" />
                                Paused
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            Unit ID: {session.unitId}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Customer Info */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{session.customerName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <a href={`tel:${session.customerPhone}`} className="text-primary hover:underline">
                            {session.customerPhone}
                          </a>
                        </div>
                      </div>

                      <div className="h-px bg-border/50" />

                      {/* Timer Info */}
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs mb-1">Elapsed</p>
                          <p className="font-semibold text-foreground">{formatDuration(elapsed)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs mb-1">Remaining</p>
                          <p className="font-semibold text-primary">{formatDuration(remaining)}</p>
                        </div>
                        {pausedDuration > 0 && (
                          <div className="col-span-2">
                            <p className="text-muted-foreground text-xs mb-1 flex items-center gap-1">
                              <Coffee className="w-3 h-3" />
                              Total Breaks
                            </p>
                            <p className="font-semibold text-warning">{formatDuration(pausedDuration)}</p>
                          </div>
                        )}
                      </div>

                      {session.pauseHistory && session.pauseHistory.length > 0 && (
                        <div className="rounded-lg bg-secondary/20 p-2">
                          <p className="text-xs text-muted-foreground mb-1">Break History</p>
                          <div className="space-y-1">
                            {session.pauseHistory.slice(-3).map((pause: any, idx: number) => (
                              <div key={idx} className="text-xs text-foreground/70">
                                Break #{session.pauseHistory.length - 2 + idx + 1}: {formatDuration(pause.duration || 0)}
                                {pause.reason && ` - ${pause.reason}`}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="h-px bg-border/50" />

                      {/* Challenge Session Info */}
                      {session.isChallengeSession && session.challengeData && (
                        <>
                          <div className="rounded-lg bg-accent/10 border border-accent/20 p-3">
                            <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              Challenge Session
                            </p>
                            <div className="text-xs text-muted-foreground space-y-1">
                              <p>Total Players: {session.challengeData.totalPlayers}</p>
                              {session.challengeData.winner && (
                                <p className="text-success font-medium">
                                  Winner: {session.challengeData.winner} (Selected by {session.challengeData.winnerSelectedBy})
                                </p>
                              )}
                              {session.status === 'ended' && !session.challengeData.winner && (
                                <p className="text-warning">Winner needs to be selected</p>
                              )}
                            </div>
                          </div>
                          <div className="h-px bg-border/50" />
                        </>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 flex-wrap">
                        {session.isChallengeSession && session.status === 'ended' && session.challengeData && !session.challengeData.winner && (
                          <Button
                            variant="glow"
                            size="sm"
                            className="flex-1 bg-accent hover:bg-accent/90"
                            onClick={() => {
                              setSelectedSession(session.id);
                              setWinnerDialogOpen(true);
                            }}
                            disabled={isLoading}
                          >
                            <Trophy className="w-4 h-4 mr-2" />
                            Select Winner
                          </Button>
                        )}
                        {isPaused ? (
                          <Button
                            variant="glow"
                            size="sm"
                            className="flex-1 bg-success hover:bg-success/90"
                            onClick={() => {
                              setSelectedSession(session.id);
                              setResumeDialogOpen(true);
                            }}
                            disabled={isLoading}
                          >
                            <Play className="w-4 h-4 mr-2" />
                            Resume
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              setSelectedSession(session.id);
                              setPauseDialogOpen(true);
                            }}
                            disabled={isLoading}
                          >
                            <Pause className="w-4 h-4 mr-2" />
                            Pause
                          </Button>
                        )}
                        <Button
                          variant="outline-destructive"
                          size="sm"
                          onClick={() => handleEndSession(session.id)}
                          disabled={isLoading}
                        >
                          <LogOut className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialogs - Only render when a session is selected to prevent unwanted popups - Admin variant */}
      {selectedSession ? (
        <>
          <PauseSessionDialog
            open={pauseDialogOpen && !!selectedSession}
            onOpenChange={(open) => {
              setPauseDialogOpen(open);
              if (!open) {
                setSelectedSession(null);
              }
            }}
            onPause={async (reason) => {
              if (selectedSession) {
                try {
                  await handlePause(selectedSession, reason);
                  setPauseDialogOpen(false);
                  setSelectedSession(null);
                } catch (error) {
                  // Error already handled in handlePause
                }
              }
            }}
            variant="admin"
          />
          <ResumeSessionDialog
            open={resumeDialogOpen && !!selectedSession}
            onOpenChange={(open) => {
              setResumeDialogOpen(open);
              if (!open) {
                setSelectedSession(null);
              }
            }}
            onResume={async () => {
              if (selectedSession) {
                try {
                  await handleResume(selectedSession);
                  setResumeDialogOpen(false);
                  setSelectedSession(null);
                } catch (error) {
                  // Error already handled in handleResume
                }
              }
            }}
            pausedDuration={getPausedDuration(sessions.find((s) => s.id === selectedSession) || {})}
            loading={actionLoading === selectedSession}
            variant="admin"
          />
          <WinnerSelectionDialog
            open={winnerDialogOpen && !!selectedSession}
            onOpenChange={(open) => {
              setWinnerDialogOpen(open);
              if (!open) {
                setSelectedSession(null);
              }
            }}
            sessionId={selectedSession || ''}
            players={sessions.find((s) => s.id === selectedSession)?.challengeData?.players || []}
            winner={sessions.find((s) => s.id === selectedSession)?.challengeData?.winner}
            onWinnerSelected={async () => {
              if (selectedSession) {
                await loadSessions();
                setWinnerDialogOpen(false);
                setSelectedSession(null);
              }
            }}
            variant="admin"
          />
        </>
      ) : null}
      <ConfirmationDialog />
    </AdminLayout>
  );
}
