import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { queueAPI, activitiesAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock, Users, RefreshCw, Play } from "lucide-react";
import { formatCurrency } from "@/lib/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ApprovalsAndQueue() {
  const { toast } = useToast();
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [waitingQueue, setWaitingQueue] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, parseInt(import.meta.env.VITE_DATA_REFRESH_INTERVAL || '5000'));
    return () => clearInterval(interval);
  }, [selectedActivity]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [approvalsData, queueData, activitiesData] = await Promise.all([
        queueAPI.getPendingApprovals(),
        queueAPI.getWaitingQueue(selectedActivity !== "all" ? selectedActivity : undefined),
        activitiesAPI.getAll(),
      ]);
      setPendingApprovals(approvalsData);
      setWaitingQueue(queueData);
      setActivities(activitiesData);
    } catch (error: any) {
      console.error("Failed to load data:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load approvals and queue data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (reservationId: string) => {
    try {
      setApprovingId(reservationId);
      await queueAPI.approveCashPayment(reservationId, selectedUnitId || undefined);
      toast({
        title: "Success",
        description: "Payment approved and session started.",
      });
      setSelectedUnitId("");
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to approve payment.",
        variant: "destructive",
      });
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (reservationId: string) => {
    try {
      await queueAPI.rejectCashPayment(reservationId);
      toast({
        title: "Success",
        description: "Payment rejected.",
      });
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reject payment.",
        variant: "destructive",
      });
    } finally {
      setRejectingId(null);
    }
  };

  const handleProcessQueue = async (activityId: string) => {
    try {
      await queueAPI.processQueue(activityId);
      toast({
        title: "Success",
        description: "Queue processed.",
      });
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to process queue.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Approvals & Queue</h1>
            <p className="text-muted-foreground">
              Manage cash payment approvals and waiting queue
            </p>
          </div>
          <Button onClick={loadData} disabled={loading} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Activity Filter */}
        <Card>
          <CardHeader>
            <CardTitle>Filter by Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedActivity} onValueChange={setSelectedActivity}>
              <SelectTrigger className="w-full md:w-[300px]">
                <SelectValue placeholder="All Activities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Activities</SelectItem>
                {activities.map((activity) => (
                  <SelectItem key={activity._id || activity.id} value={activity._id || activity.id}>
                    {activity.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Pending Approvals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Pending Approvals ({pendingApprovals.length})
            </CardTitle>
            <CardDescription>
              Cash payments waiting for admin approval
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : pendingApprovals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No pending approvals
              </div>
            ) : (
              <div className="space-y-4">
                {pendingApprovals.map((approval) => (
                  <Card key={approval.id} className="border-primary/20">
                    <CardContent className="pt-6">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-lg">{approval.customerName}</h3>
                            <Badge variant="outline">{approval.customerPhone}</Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-muted-foreground">
                            <div>
                              <span className="font-medium">Activity:</span>{" "}
                              {approval.activityId?.name || "N/A"}
                            </div>
                            <div>
                              <span className="font-medium">Duration:</span>{" "}
                              {approval.durationMinutes} min
                            </div>
                            <div>
                              <span className="font-medium">Amount:</span>{" "}
                              {formatCurrency(approval.amount)}
                            </div>
                            <div>
                              <span className="font-medium">Requested:</span>{" "}
                              {formatDate(approval.createdAt)}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleApprove(approval.id)}
                            disabled={approvingId === approval.id}
                            size="sm"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Approve
                          </Button>
                          <Button
                            onClick={() => setRejectingId(approval.id)}
                            disabled={rejectingId === approval.id}
                            variant="destructive"
                            size="sm"
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Waiting Queue */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Waiting Queue ({waitingQueue.length})
            </CardTitle>
            <CardDescription>
              Customers waiting for available systems (FIFO order)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : waitingQueue.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No one in waiting queue
              </div>
            ) : (
              <div className="space-y-4">
                {waitingQueue.map((entry, index) => (
                  <Card key={entry.id} className="border-primary/20">
                    <CardContent className="pt-6">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="default" className="text-lg px-3 py-1">
                              #{entry.position}
                            </Badge>
                            <h3 className="font-semibold text-lg">{entry.customerName}</h3>
                            <Badge variant="outline">{entry.customerPhone}</Badge>
                            <Badge
                              variant={entry.paymentStatus === "paid" ? "default" : "secondary"}
                            >
                              {entry.paymentStatus === "paid" ? "Paid" : "Offline"}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-muted-foreground">
                            <div>
                              <span className="font-medium">Activity:</span>{" "}
                              {entry.activityId?.name || "N/A"}
                            </div>
                            <div>
                              <span className="font-medium">Duration:</span>{" "}
                              {entry.durationMinutes} min
                            </div>
                            <div>
                              <span className="font-medium">Amount:</span>{" "}
                              {formatCurrency(entry.amount)}
                            </div>
                            <div>
                              <span className="font-medium">Joined:</span>{" "}
                              {formatDate(entry.createdAt)}
                            </div>
                          </div>
                        </div>
                        {entry.activityId && (
                          <Button
                            onClick={() => handleProcessQueue(entry.activityId._id || entry.activityId.id)}
                            size="sm"
                            variant="outline"
                          >
                            <Play className="w-4 h-4 mr-2" />
                            Process Queue
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reject Confirmation Dialog */}
        <AlertDialog 
          open={!!rejectingId} 
          onOpenChange={(open) => {
            // Only close if explicitly closing, prevent flickering
            if (!open && rejectingId) {
              setRejectingId(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reject Payment?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to reject this cash payment? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setRejectingId(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (rejectingId) {
                    handleReject(rejectingId);
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Reject
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
}
