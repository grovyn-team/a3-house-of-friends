import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, Plus, ShoppingCart, Receipt, LogOut, Pause, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { sessionsAPI } from '@/lib/api';
import { Session, QRContext } from '@/lib/types';
import { formatDuration } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useTimer } from '@/hooks/useTimer';
import { useWebSocket } from '@/hooks/useWebSocket';
import { WinnerSelectionDialog } from '@/components/WinnerSelectionDialog';
import { useConfirmation } from '@/components/ui/confirmation-dialog';

export default function SessionTimer() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { confirm, ConfirmationDialog } = useConfirmation();
  const location = useLocation();
  const [session, setSession] = useState<Session | null>(null);
  const [isExtended, setIsExtended] = useState(false);
  const [loading, setLoading] = useState(true);
  const [winnerDialogOpen, setWinnerDialogOpen] = useState(false);

  const isPaused = session?.status === 'paused' || !!session?.currentPauseStart;

  const handleDialogWinnerSelected = async () => {
    if (session?.id) {
      try {
        const updatedSession = await sessionsAPI.getById(session.id);
        setSession(updatedSession);
      } catch (error) {
        console.error('Error refreshing session:', error);
      }
    }
  };
  
  const { elapsed, remaining, isActive, formatTime } = useTimer(
    session?.id || null,
    session?.actualStartTime || session?.startTime,
    session?.endTime,
    isPaused,
    session?.currentPauseStart,
    session?.totalPausedDuration
  );

  const { on, isConnected, joinRoom, emit } = useWebSocket({ namespace: 'customer' });

  useEffect(() => {
    const loadSession = async () => {
      const sessionData = location.state?.session || sessionStorage.getItem('currentSession');
      
      if (sessionData) {
        try {
          const parsed = typeof sessionData === 'string' ? JSON.parse(sessionData) : sessionData;
          const sessionId = parsed.id || parsed._id;
          
          if (sessionId) {
            try {
              const freshSession = await sessionsAPI.getById(sessionId);
              
              if (freshSession.status === 'ended' || freshSession.status === 'completed' || freshSession.status === 'cancelled') {
                sessionStorage.removeItem('currentSession');
                toast({
                  title: 'Session Ended',
                  description: 'This session has ended.',
                  variant: 'default',
                });
                navigate('/my-bookings');
                return;
              }
              
              setSession(freshSession);
              sessionStorage.setItem('currentSession', JSON.stringify(freshSession));
            } catch (error: any) {
              if (error.message?.includes('not found') || error.message?.includes('404')) {
                sessionStorage.removeItem('currentSession');
                toast({
                  title: 'Session Not Found',
                  description: 'This session no longer exists.',
                  variant: 'destructive',
                });
                navigate('/my-bookings');
                return;
              }
              
              const parsedSession = parsed;
              parsedSession.startTime = new Date(parsedSession.startTime);
              parsedSession.endTime = new Date(parsedSession.endTime);
              if (parsedSession.currentPauseStart) {
                parsedSession.currentPauseStart = new Date(parsedSession.currentPauseStart);
              }
              if (parsedSession.pauseHistory) {
                parsedSession.pauseHistory = parsedSession.pauseHistory.map((pause: any) => ({
                  ...pause,
                  startTime: new Date(pause.startTime),
                  endTime: pause.endTime ? new Date(pause.endTime) : undefined,
                }));
              }
              if (parsedSession.challengeData) {
                parsedSession.challengeData = {
                  ...parsedSession.challengeData,
                  winnerSelectedAt: parsedSession.challengeData.winnerSelectedAt 
                    ? new Date(parsedSession.challengeData.winnerSelectedAt) 
                    : undefined,
                };
              }
              setSession(parsedSession);
            }
          } else {
            const parsedSession = parsed;
            parsedSession.startTime = new Date(parsedSession.startTime);
            parsedSession.endTime = new Date(parsedSession.endTime);
            if (parsedSession.currentPauseStart) {
              parsedSession.currentPauseStart = new Date(parsedSession.currentPauseStart);
            }
            if (parsedSession.pauseHistory) {
              parsedSession.pauseHistory = parsedSession.pauseHistory.map((pause: any) => ({
                ...pause,
                startTime: new Date(pause.startTime),
                endTime: pause.endTime ? new Date(pause.endTime) : undefined,
              }));
            }
            if (parsedSession.challengeData) {
              parsedSession.challengeData = {
                ...parsedSession.challengeData,
                winnerSelectedAt: parsedSession.challengeData.winnerSelectedAt 
                  ? new Date(parsedSession.challengeData.winnerSelectedAt) 
                  : undefined,
              };
            }
            setSession(parsedSession);
          }
        } catch (e) {
          console.error('Error parsing session:', e);
          sessionStorage.removeItem('currentSession');
          navigate('/');
        }
      } else {
        navigate('/');
      }
      setLoading(false);
    };
    
    loadSession();
  }, [location.state, navigate, toast]);

  useEffect(() => {
    if (remaining > 0 && remaining <= 300) {
      toast({
        title: 'Session Ending Soon',
        description: 'Less than 5 minutes remaining. Extend your session?',
      });
    }
  }, [remaining, toast]);

  useEffect(() => {
    if (isConnected && session?.id) {
      joinRoom(`session:${session.id}`);
    }
  }, [isConnected, session?.id, joinRoom]);

  useEffect(() => {
    if (!session?.id) return;

    const refreshInterval = setInterval(async () => {
      try {
        const freshSession = await sessionsAPI.getById(session.id);
        
        if (freshSession.status === 'ended' || freshSession.status === 'completed' || freshSession.status === 'cancelled') {
          sessionStorage.removeItem('currentSession');
          setSession(freshSession);
          toast({
            title: 'Session Ended',
            description: 'This session has ended.',
            variant: 'default',
          });
          setTimeout(() => {
            navigate('/my-bookings');
          }, 2000);
          return;
        }
        
        setSession(freshSession);
        sessionStorage.setItem('currentSession', JSON.stringify(freshSession));
      } catch (error: any) {
        if (error.message?.includes('not found') || error.message?.includes('404')) {
          sessionStorage.removeItem('currentSession');
          toast({
            title: 'Session Not Found',
            description: 'This session no longer exists.',
            variant: 'destructive',
          });
          setTimeout(() => {
            navigate('/my-bookings');
          }, 2000);
        }
      }
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, [session?.id, navigate, toast]);

  useEffect(() => {
    if (!isConnected || !session) return;

    const handleTimerUpdate = (data: any) => {
      if (data.session_id === session.id) {
        if (data.new_end_time) {
          setSession(prev => prev ? { ...prev, endTime: new Date(data.new_end_time) } : null);
        }
      }
    };

    const handleQueueRemoved = (data: any) => {
      if (data.type === 'session' && data.sessionId === session.id) {
        handleSessionEnd();
        toast({
          title: 'Session Ended',
          description: data.message || 'Your session has been ended by admin.',
          variant: 'destructive',
        });
      }
    };

    const handleQueueAssigned = (data: any) => {
      if (data.type === 'session' && data.sessionId === session.id) {
        toast({
          title: 'Session Activated',
          description: data.message || 'Your session has been activated!',
        });
        sessionsAPI.getById(session.id).then(updatedSession => {
          setSession(updatedSession);
        });
      }
    };

    const handleSessionEnded = (data: any) => {
      if (data.session_id === session.id) {
        sessionStorage.removeItem('currentSession');
        
        setSession(prev => prev ? {
          ...prev,
          status: 'ended',
          finalAmount: data.finalAmount || prev.finalAmount,
          totalPausedDuration: data.totalPausedDuration || prev.totalPausedDuration,
          actualEndTime: data.actualEndTime ? new Date(data.actualEndTime) : prev.actualEndTime,
        } : null);
        
        toast({
          title: 'Session Ended',
          description: `Session ended. Final amount: ₹${data.finalAmount || session?.finalAmount || 0}`,
        });
        
        setTimeout(() => {
          handleSessionEnd();
        }, 2000);
      }
    };

    const handleChallengeSessionEnded = (data: any) => {
      if (data.session_id === session.id && session.isChallengeSession) {
        setWinnerDialogOpen(true);
      }
    };

    const handleWinnerSelected = (data: any) => {
      if (data.session_id === session.id) {
        sessionsAPI.getById(session.id).then(updatedSession => {
          setSession(updatedSession);
          if (data.winner) {
            setWinnerDialogOpen(false);
          }
        });
      }
    };

    const handleSessionPaused = (data: any) => {
      if (data.session_id === session.id) {
        setSession(prev => prev ? {
          ...prev,
          status: 'paused',
          currentPauseStart: data.currentPauseStart ? new Date(data.currentPauseStart) : undefined,
          pauseHistory: data.pauseHistory || prev.pauseHistory || [],
        } : null);
        
        if (data.pausedBy === 'admin') {
          toast({
            title: 'Session Paused',
            description: data.reason || 'Your session has been paused by admin.',
            variant: 'default',
          });
        }
      }
    };

    const handleSessionResumed = (data: any) => {
      if (data.session_id === session.id) {
        setSession(prev => prev ? {
          ...prev,
          status: 'active',
          endTime: data.endTime ? new Date(data.endTime) : prev.endTime,
          currentPauseStart: undefined,
          totalPausedDuration: data.totalPausedDuration || prev.totalPausedDuration || 0,
          pauseHistory: data.pauseHistory || prev.pauseHistory || [],
        } : null);
        
        if (data.resumedBy === 'admin') {
          toast({
            title: 'Session Resumed',
            description: 'Your session has been resumed by admin.',
            variant: 'default',
          });
        }
      }
    };

    const cleanupTimer = on('timer_update', handleTimerUpdate);
    const cleanupRemoved = on('queue_removed', handleQueueRemoved);
    const cleanupAssigned = on('queue_assigned', handleQueueAssigned);
    const cleanupEnded = on('session_ended', handleSessionEnded);
    const cleanupPaused = on('session_paused', handleSessionPaused);
    const cleanupResumed = on('session_resumed', handleSessionResumed);
    const cleanupChallengeEnded = on('challenge_session_ended', handleChallengeSessionEnded);
    const cleanupWinnerSelected = on('winner_selected', handleWinnerSelected);

    return () => {
      cleanupTimer();
      cleanupRemoved();
      cleanupAssigned();
      cleanupEnded();
      cleanupPaused();
      cleanupResumed();
      cleanupChallengeEnded();
      cleanupWinnerSelected();
    };
  }, [isConnected, session, on, toast]);

  const handleSessionEnd = async () => {
    if (session) {
      try {
        await sessionsAPI.end(session.id);
      } catch (error) {
        console.error('Error ending session:', error);
      }
    }
    toast({
      title: 'Session Ended',
      description: 'Your session time has expired.',
    });
    sessionStorage.removeItem('currentSession');
    navigate('/');
  };

  const handleExtend = () => {
    navigate('/extend', {
      state: { session, qrContext: session?.qrContext },
    });
  };

  const handleOrderFood = () => {
    navigate('/menu', {
      state: {
        qrContext: session?.qrContext,
        sessionId: session?.id,
      },
    });
  };

  const handleViewReceipt = () => {
    navigate('/receipt', {
      state: { session },
    });
  };

  const handleEndSession = async () => {
    confirm({
      title: "End Session Early?",
      description: "Are you sure you want to end your session early? This action cannot be undone.",
      variant: "destructive",
      confirmText: "End Session",
      cancelText: "Cancel",
      onConfirm: async () => {
        if (session) {
          try {
            await sessionsAPI.end(session.id);
          } catch (error) {
            console.error('Error ending session:', error);
            throw error;
          }
        }
        sessionStorage.removeItem('currentSession');
        toast({
          title: 'Session Ended',
          description: 'Your session has been ended.',
        });
        navigate('/');
      },
    });
  };

  const pausedDuration = session?.currentPauseStart 
    ? Math.round((Date.now() - new Date(session.currentPauseStart).getTime()) / (1000 * 60))
    : 0;

  if (loading || !session) {
    return (
      <div className="min-h-screen gradient-mesh flex items-center justify-center">
        <div className="text-muted-foreground">Loading session...</div>
      </div>
    );
  }

  const isLowTime = remaining < 300; // Less than 5 minutes
  const timeDisplay = formatTime(remaining);

  return (
    <div className="min-h-screen gradient-mesh flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Timer Display */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-8"
        >
          <Card className="glass-strong border-2">
            {session.isChallengeSession && session.challengeData && (
              <div className="px-6 pt-4 pb-2">
                <div className="bg-accent/10 border border-accent/20 rounded-lg p-3 mb-2">
                  <p className="text-xs font-medium text-foreground mb-1 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    Challenge Session
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Players: {session.challengeData.players?.map((p: any) => p.name).join(', ')}
                  </p>
                </div>
              </div>
            )}
            <CardContent className="pt-12 pb-12">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-4">
                  {isPaused ? (
                    <Pause className={`w-6 h-6 text-warning`} />
                  ) : (
                    <Clock className={`w-6 h-6 ${isLowTime ? 'text-destructive' : 'text-primary'}`} />
                  )}
                  <span className={`text-sm font-medium uppercase tracking-wide ${
                    isPaused ? 'text-warning' : 'text-muted-foreground'
                  }`}>
                    {isPaused ? 'Session Paused' : isActive ? 'Active Session' : 'Inactive'}
                  </span>
                </div>

                {isPaused && pausedDuration > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-warning font-medium mb-4"
                  >
                    Paused for {formatDuration(pausedDuration)}
                  </motion.div>
                )}

                <div className={`text-6xl md:text-7xl font-mono font-bold mb-2 neon-text ${isLowTime ? 'text-destructive' : 'text-primary'}`}>
                  {timeDisplay}
                </div>

                <p className="text-sm text-muted-foreground mb-6">
                  {session.activityId.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </p>

                {isLowTime && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-destructive font-medium mb-4"
                  >
                    Session ending soon
                  </motion.div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            variant="glow"
            size="lg"
            className="w-full"
            onClick={handleExtend}
            disabled={isPaused}
          >
            <Plus className="w-4 h-4 mr-2" />
            Extend Session
          </Button>

          {isPaused && (
            <div className="glass rounded-2xl p-4 border border-warning/30">
              <div className="flex items-start gap-2">
                <Pause className="w-4 h-4 text-warning mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-foreground">Session is paused</p>
                  <p className="text-muted-foreground mt-1">
                    Please contact the staff/admin to resume your session.
                  </p>
                </div>
              </div>
            </div>
          )}

          <Button
            variant="default"
            size="lg"
            className="w-full glass"
            onClick={handleOrderFood}
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Order Food
          </Button>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              size="lg"
              className="glass"
              onClick={handleViewReceipt}
            >
              <Receipt className="w-4 h-4 mr-2" />
              Receipt
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="glass"
              onClick={handleEndSession}
            >
              <LogOut className="w-4 h-4 mr-2" />
              End Session
            </Button>
          </div>
        </div>

        {/* Session Info */}
        <div className="mt-6 text-center space-y-1">
          <p className="text-xs text-muted-foreground">
            Started at {new Date(session.startTime).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
          {session.totalPausedDuration && session.totalPausedDuration > 0 && (
            <p className="text-xs text-muted-foreground">
              Total breaks: {formatDuration(session.totalPausedDuration)}
            </p>
          )}
        </div>
      </div>
      
      {/* Winner Selection Dialog for Challenge Sessions */}
      {session?.isChallengeSession && session.challengeData && (
        <WinnerSelectionDialog
          open={winnerDialogOpen}
          onOpenChange={setWinnerDialogOpen}
          sessionId={session.id}
          players={session.challengeData.players || []}
          currentPlayerName={session.customerName}
          winner={session.challengeData.winner}
          onWinnerSelected={handleDialogWinnerSelected}
          variant="user"
        />
      )}
      <ConfirmationDialog />
    </div>
  );
}

