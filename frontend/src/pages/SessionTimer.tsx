import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, Plus, ShoppingCart, Receipt, LogOut, Pause, Play, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { sessionsAPI } from '@/lib/api';
import { Session, QRContext } from '@/lib/types';
import { formatDuration } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useTimer } from '@/hooks/useTimer';
import { useWebSocket } from '@/hooks/useWebSocket';
import { PauseSessionDialog } from '@/components/PauseSessionDialog';
import { ResumeSessionDialog } from '@/components/ResumeSessionDialog';
import { WinnerSelectionDialog } from '@/components/WinnerSelectionDialog';

export default function SessionTimer() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const location = useLocation();
  const [session, setSession] = useState<Session | null>(null);
  const [isExtended, setIsExtended] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
  const [resumeDialogOpen, setResumeDialogOpen] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [winnerDialogOpen, setWinnerDialogOpen] = useState(false);

  const isPaused = session?.status === 'paused' || !!session?.currentPauseStart;

  // Handler for when winner is selected in the dialog
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
  
  // Use real-time timer hook - updates every second with WebSocket sync every 10 seconds
  const { elapsed, remaining, isActive, formatTime } = useTimer(
    session?.id || null,
    session?.actualStartTime || session?.startTime,
    session?.endTime,
    isPaused,
    session?.currentPauseStart,
    session?.totalPausedDuration
  );

  // WebSocket for real-time updates
  const { on, isConnected, joinRoom, emit } = useWebSocket({ namespace: 'customer' });

  useEffect(() => {
    // Get session from location state or storage
    const sessionData = location.state?.session || sessionStorage.getItem('currentSession');
    
    if (sessionData) {
      try {
        const parsed = typeof sessionData === 'string' ? JSON.parse(sessionData) : sessionData;
        // Convert date strings back to Date objects
        parsed.startTime = new Date(parsed.startTime);
        parsed.endTime = new Date(parsed.endTime);
        if (parsed.currentPauseStart) {
          parsed.currentPauseStart = new Date(parsed.currentPauseStart);
        }
        if (parsed.pauseHistory) {
          parsed.pauseHistory = parsed.pauseHistory.map((pause: any) => ({
            ...pause,
            startTime: new Date(pause.startTime),
            endTime: pause.endTime ? new Date(pause.endTime) : undefined,
          }));
        }
        if (parsed.challengeData) {
          parsed.challengeData = {
            ...parsed.challengeData,
            winnerSelectedAt: parsed.challengeData.winnerSelectedAt 
              ? new Date(parsed.challengeData.winnerSelectedAt) 
              : undefined,
          };
        }
        setSession(parsed);
        setLoading(false);
      } catch (e) {
        console.error('Error parsing session:', e);
        navigate('/');
      }
    } else {
      navigate('/');
    }
  }, [location.state, navigate]);

  // Listen for session ending soon event
  useEffect(() => {
    if (remaining > 0 && remaining <= 300) {
      toast({
        title: 'Session Ending Soon',
        description: 'Less than 5 minutes remaining. Extend your session?',
      });
    }
  }, [remaining, toast]);

  // Join session room for real-time updates
  useEffect(() => {
    if (isConnected && session?.id) {
      joinRoom(`session:${session.id}`);
    }
  }, [isConnected, session?.id, joinRoom]);

  // Listen for WebSocket events
  useEffect(() => {
    if (!isConnected || !session) return;

    // Listen for timer updates (session extension)
    const handleTimerUpdate = (data: any) => {
      if (data.session_id === session.id) {
        // Update session end time if extended
        if (data.new_end_time) {
          setSession(prev => prev ? { ...prev, endTime: new Date(data.new_end_time) } : null);
        }
      }
    };

    // Listen for queue removal (session ended by admin)
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

    // Listen for queue assignment (session activated by admin)
    const handleQueueAssigned = (data: any) => {
      if (data.type === 'session' && data.sessionId === session.id) {
        toast({
          title: 'Session Activated',
          description: data.message || 'Your session has been activated!',
        });
        // Reload session data
        sessionsAPI.getById(session.id).then(updatedSession => {
          setSession(updatedSession);
        });
      }
    };

    // Listen for session ended event
    const handleSessionEnded = (data: any) => {
      if (data.session_id === session.id) {
        // Update session with final data
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
        
        // Navigate after a short delay
        setTimeout(() => {
          handleSessionEnd();
        }, 2000);
      }
    };

    // Listen for challenge session ended event
    const handleChallengeSessionEnded = (data: any) => {
      if (data.session_id === session.id && session.isChallengeSession) {
        setWinnerDialogOpen(true);
      }
    };

    // Listen for winner selection updates
    const handleWinnerSelected = (data: any) => {
      if (data.session_id === session.id) {
        // Refresh session data
        sessionsAPI.getById(session.id).then(updatedSession => {
          setSession(updatedSession);
          if (data.winner) {
            setWinnerDialogOpen(false);
          }
        });
      }
    };

    // Listen for session paused event
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

    // Listen for session resumed event
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
    if (confirm('Are you sure you want to end your session early?')) {
      if (session) {
        try {
          await sessionsAPI.end(session.id);
        } catch (error) {
          console.error('Error ending session:', error);
        }
      }
      sessionStorage.removeItem('currentSession');
      toast({
        title: 'Session Ended',
        description: 'Your session has been ended.',
      });
      navigate('/');
    }
  };

  const handlePause = async (reason?: string) => {
    if (!session) return;
    setIsPausing(true);
    try {
      const updated = await sessionsAPI.pause(session.id, reason, 'customer');
      setSession(prev => prev ? {
        ...prev,
        status: 'paused',
        currentPauseStart: updated.currentPauseStart ? new Date(updated.currentPauseStart) : undefined,
        pauseHistory: updated.pauseHistory || prev.pauseHistory || [],
      } : null);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to pause session',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsPausing(false);
    }
  };

  const handleResume = async () => {
    if (!session) return;
    setIsResuming(true);
    try {
      const updated = await sessionsAPI.resume(session.id, 'customer');
      setSession(prev => prev ? {
        ...prev,
        status: 'active',
        endTime: updated.endTime ? new Date(updated.endTime) : prev.endTime,
        currentPauseStart: undefined,
        totalPausedDuration: updated.totalPausedDuration || prev.totalPausedDuration || 0,
        pauseHistory: updated.pauseHistory || prev.pauseHistory || [],
      } : null);
      toast({
        title: 'Session Resumed',
        description: 'Your session has been resumed. Timer is running again.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to resume session',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsResuming(false);
    }
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
          {isPaused ? (
            <Button
              variant="glow"
              size="lg"
              className="w-full bg-success hover:bg-success/90"
              onClick={() => setResumeDialogOpen(true)}
              disabled={isResuming}
            >
              <Play className="w-4 h-4 mr-2" />
              {isResuming ? 'Resuming...' : 'Resume Session'}
            </Button>
          ) : (
            <>
              <Button
                variant="glow"
                size="lg"
                className="w-full"
                onClick={handleExtend}
              >
                <Plus className="w-4 h-4 mr-2" />
                Extend Session
              </Button>

              <Button
                variant="default"
                size="lg"
                className="w-full glass"
                onClick={() => setPauseDialogOpen(true)}
                disabled={isPausing}
              >
                <Pause className="w-4 h-4 mr-2" />
                {isPausing ? 'Pausing...' : 'Pause Session'}
              </Button>
            </>
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

      {/* Dialogs - Mobile variant for user */}
      <PauseSessionDialog
        open={pauseDialogOpen}
        onOpenChange={setPauseDialogOpen}
        onPause={handlePause}
        variant="mobile"
      />
      <ResumeSessionDialog
        open={resumeDialogOpen}
        onOpenChange={setResumeDialogOpen}
        onResume={handleResume}
        pausedDuration={pausedDuration}
        loading={isResuming}
        variant="mobile"
      />
      
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
    </div>
  );
}

