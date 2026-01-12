import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { sessionsAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/useWebSocket";
import { 
  Clock, 
  User, 
  Phone, 
  RefreshCw, 
  Calendar,
  CheckCircle,
  XCircle,
  Pause,
  Play,
  Filter,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { formatDuration, formatCurrency } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function SessionHistory() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // WebSocket for real-time updates
  const { on, isConnected } = useWebSocket({ namespace: 'admin' });

  useEffect(() => {
    loadSessions();
  }, [offset, statusFilter]);

  // Listen for session ended event for real-time updates
  useEffect(() => {
    if (!isConnected) return;

    const handleSessionEnded = (data: any) => {
      // Refresh session list when a session is ended
      loadSessions();
    };

    const cleanup = on('session_ended', handleSessionEnded);
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, on]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const status = statusFilter === 'all' ? undefined : statusFilter;
      const data = await sessionsAPI.getAll(limit, offset, status);
      const processed = data.sessions.map((s: any) => ({
        ...s,
        startTime: new Date(s.startTime),
        endTime: new Date(s.endTime),
        actualStartTime: s.actualStartTime ? new Date(s.actualStartTime) : undefined,
        actualEndTime: s.actualEndTime ? new Date(s.actualEndTime) : undefined,
        currentPauseStart: s.currentPauseStart ? new Date(s.currentPauseStart) : undefined,
        pauseHistory: (s.pauseHistory || []).map((p: any) => ({
          ...p,
          startTime: new Date(p.startTime),
          endTime: p.endTime ? new Date(p.endTime) : undefined,
        })),
        createdAt: new Date(s.createdAt),
        updatedAt: new Date(s.updatedAt),
      }));
      setSessions(processed);
      setTotal(data.total);
    } catch (error: any) {
      console.error('Failed to load session history:', error);
      toast({
        title: "Error",
        description: "Failed to load session history.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-success/20 text-success border-success/30">Active</Badge>;
      case 'paused':
        return <Badge className="bg-warning/20 text-warning border-warning/30 flex items-center gap-1"><Pause className="w-3 h-3" /> Paused</Badge>;
      case 'completed':
      case 'ended':
        return <Badge className="bg-primary/20 text-primary border-primary/30 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-success/20 text-success border-success/30">Paid</Badge>;
      case 'pending':
        return <Badge className="bg-warning/20 text-warning border-warning/30">Pending</Badge>;
      case 'failed':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getElapsedTime = (session: any) => {
    if (session.status === 'paused' && session.currentPauseStart) {
      const pauseStart = new Date(session.currentPauseStart).getTime();
      const elapsedUntilPause = pauseStart - new Date(session.startTime).getTime();
      return Math.floor(elapsedUntilPause / (1000 * 60));
    }
    const end = session.actualEndTime || new Date();
    const start = session.actualStartTime || session.startTime;
    const paused = session.totalPausedDuration || 0;
    const elapsed = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60)) - paused;
    return Math.max(0, elapsed);
  };

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  if (loading && sessions.length === 0) {
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
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Session History</h1>
            <p className="text-muted-foreground mt-1">
              View all gaming sessions and their details
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sessions</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="ended">Ended</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={loadSessions}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {sessions.length === 0 ? (
          <Card className="glass text-center py-12">
            <CardContent>
              <p className="text-muted-foreground">No session history found.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 w-full max-w-5xl mx-auto">
              {sessions.map((session, index) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="w-full"
                >
                  <Card className="glass border-primary/20 hover:border-primary/30 transition-all w-full">
                    <CardHeader>
                      <div className="flex items-start justify-between flex-wrap gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <CardTitle className="text-lg">{session.customerName}</CardTitle>
                            {getStatusBadge(session.status)}
                            {getPaymentStatusBadge(session.paymentStatus)}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                            <div className="flex items-center gap-1">
                              <Phone className="w-4 h-4" />
                              {session.customerPhone}
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {formatDate(session.createdAt)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary">
                            {formatCurrency(session.finalAmount || session.totalAmount || 0)}
                          </p>
                          {session.finalAmount !== session.totalAmount && (
                            <p className="text-xs text-muted-foreground line-through">
                              {formatCurrency(session.totalAmount)}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-secondary/30 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Service</p>
                          <p className="font-semibold text-foreground">{session.activityType}</p>
                        </div>
                        <div className="bg-secondary/30 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Duration</p>
                          <p className="font-semibold text-foreground">{formatDuration(getElapsedTime(session))}</p>
                        </div>
                        <div className="bg-secondary/30 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Start Time</p>
                          <p className="font-semibold text-foreground text-sm">
                            {formatDate(session.actualStartTime || session.startTime)}
                          </p>
                        </div>
                        {session.actualEndTime && (
                          <div className="bg-secondary/30 rounded-lg p-3">
                            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">End Time</p>
                            <p className="font-semibold text-foreground text-sm">
                              {formatDate(session.actualEndTime)}
                            </p>
                          </div>
                        )}
                      </div>

                      {session.totalPausedDuration > 0 && (
                        <div className="mt-4 pt-4 border-t border-border/50">
                          <p className="text-sm font-medium text-foreground mb-2">
                            Break History ({formatDuration(session.totalPausedDuration)} total)
                          </p>
                          <div className="space-y-2">
                            {session.pauseHistory?.slice(0, 3).map((pause: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between text-sm bg-secondary/20 rounded-lg p-2">
                                <div className="flex items-center gap-2">
                                  <Pause className="w-3 h-3 text-warning" />
                                  <span className="text-muted-foreground">
                                    {formatDate(pause.startTime)}
                                  </span>
                                  {pause.endTime && (
                                    <>
                                      <span className="text-muted-foreground">-</span>
                                      <span className="text-muted-foreground">
                                        {formatDate(pause.endTime)}
                                      </span>
                                    </>
                                  )}
                                </div>
                                <span className="font-medium text-foreground">
                                  {formatDuration(pause.duration || 0)}
                                </span>
                              </div>
                            ))}
                            {session.pauseHistory && session.pauseHistory.length > 3 && (
                              <p className="text-xs text-muted-foreground text-center">
                                +{session.pauseHistory.length - 3} more breaks
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {offset + 1} to {Math.min(offset + limit, total)} of {total} sessions
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOffset(Math.max(0, offset - limit))}
                    disabled={offset === 0 || loading}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOffset(Math.min(total - limit, offset + limit))}
                    disabled={offset + limit >= total || loading}
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
