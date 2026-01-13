import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  ChevronRight,
  Trash2
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

  const { on, isConnected } = useWebSocket({ namespace: 'admin' });

  useEffect(() => {
    loadSessions();
  }, [offset, statusFilter]);

  useEffect(() => {
    if (!isConnected) return;

    const handleSessionEnded = (data: any) => {
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
        return <Badge className="bg-primary/20 text-primary border-primary/30 hover:bg-primary/20 hover:text-primary flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-success/20 text-success border-success/30 hover:bg-success/20 hover:text-success">Paid</Badge>;
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

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await sessionsAPI.delete(sessionId);
      toast({
        title: "Success",
        description: "Session deleted successfully.",
      });
      // Reload sessions after deletion
      loadSessions();
    } catch (error: any) {
      console.error('Failed to delete session:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete session.",
        variant: "destructive",
      });
    }
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
      <div className="space-y-6 -mx-4 md:-mx-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-4 md:px-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Session History</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              View all gaming sessions and their details
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
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
            <div className="w-full">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                {sessions.map((session, index) => (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="w-full"
                  >
                    <Card className="glass border-primary/20 hover:border-primary/30 transition-all w-full h-full flex flex-col">
                    <CardHeader className="pb-3">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-lg mb-2 truncate">{session.customerName}</CardTitle>
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              {getStatusBadge(session.status)}
                              {getPaymentStatusBadge(session.paymentStatus)}
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Phone className="w-4 h-4 flex-shrink-0" />
                                <span className="truncate">{session.customerPhone}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4 flex-shrink-0" />
                                <span className="truncate">{formatDate(session.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            <p className="text-xl sm:text-2xl font-bold text-primary">
                              {formatCurrency(session.finalAmount ?? session.totalAmount ?? 0)}
                            </p>
                            {(() => {
                              const finalAmount = session.finalAmount ?? 0;
                              const totalAmount = session.totalAmount ?? 0;
                              const finalNum = Number(finalAmount);
                              const totalNum = Number(totalAmount);
                              const hasDiscount = finalNum > 0 && totalNum > 0 && Math.abs(finalNum - totalNum) > 0.01;
                              return hasDiscount ? (
                                <p className="text-xs text-muted-foreground line-through">
                                  {formatCurrency(totalAmount)}
                                </p>
                              ) : null;
                            })()}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 flex-1 flex flex-col">
                      <div className="flex-1 flex flex-col">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-secondary/30 rounded-lg p-3">
                            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Service</p>
                            <p className="font-semibold text-foreground text-sm break-words">{session.activityType}</p>
                          </div>
                          <div className="bg-secondary/30 rounded-lg p-3">
                            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Duration</p>
                            <p className="font-semibold text-foreground text-sm">{formatDuration(getElapsedTime(session))}</p>
                          </div>
                          <div className="bg-secondary/30 rounded-lg p-3 col-span-2">
                            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Start Time</p>
                            <p className="font-semibold text-foreground text-xs break-words">
                              {formatDate(session.actualStartTime || session.startTime)}
                            </p>
                          </div>
                          {session.actualEndTime && (
                            <div className="bg-secondary/30 rounded-lg p-3 col-span-2">
                              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">End Time</p>
                              <p className="font-semibold text-foreground text-xs break-words">
                                {formatDate(session.actualEndTime)}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="mt-4 pt-4 border-t border-border/50">
                          <p className="text-sm font-medium text-foreground mb-2">
                            Break History {session.totalPausedDuration > 0 && `(${formatDuration(session.totalPausedDuration)} total)`}
                          </p>
                          {session.totalPausedDuration > 0 && session.pauseHistory && session.pauseHistory.length > 0 ? (
                            <div className="space-y-2 max-h-[88px] overflow-y-auto pr-1">
                              {session.pauseHistory.map((pause: any, idx: number) => (
                                <div key={idx} className="flex items-start sm:items-center justify-between gap-2 text-sm bg-secondary/20 rounded-lg p-2 flex-shrink-0">
                                  <div className="flex items-start sm:items-center gap-2 min-w-0 flex-1">
                                    <Pause className="w-3 h-3 text-warning flex-shrink-0 mt-0.5 sm:mt-0" />
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 min-w-0">
                                      <span className="text-muted-foreground text-xs break-words">
                                        {formatDate(pause.startTime)}
                                      </span>
                                      {pause.endTime && (
                                        <>
                                          <span className="text-muted-foreground hidden sm:inline">-</span>
                                          <span className="text-muted-foreground text-xs break-words">
                                            {formatDate(pause.endTime)}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <span className="font-medium text-foreground flex-shrink-0 text-xs">
                                    {formatDuration(pause.duration || 0)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2 py-4 bg-secondary/20 rounded-lg">
                              <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
                              <p className="text-sm text-muted-foreground">No breaks taken</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-auto pt-4 border-t border-border/50">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="w-full"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Session
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the session record for{" "}
                                <strong>{session.customerName}</strong> from the database.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteSession(session.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 md:px-6">
                <p className="text-sm text-muted-foreground text-center sm:text-left">
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
                    <span className="hidden sm:inline">Previous</span>
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOffset(Math.min(total - limit, offset + limit))}
                    disabled={offset + limit >= total || loading}
                  >
                    <span className="hidden sm:inline">Next</span>
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
