import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { StationCard } from "@/components/admin/StationCard";
import { RevenueCard, QueuePreviewCard } from "@/components/admin/StatsCards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sessionsAPI, activitiesAPI, ordersAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Activity } from "lucide-react";
import { calculateRevenueBreakdown, calculateTotalRevenue } from "@/lib/revenue";

export default function AdminDashboard() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [stations, setStations] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { on, isConnected } = useWebSocket({ namespace: 'admin' });

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
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
      loadData();
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
      loadData();
    };

    const handleTimerUpdate = (data: any) => {
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

    const cleanupPaused = on('session_paused', handleSessionPaused);
    const cleanupResumed = on('session_resumed', handleSessionResumed);
    const cleanupTimer = on('timer_update', handleTimerUpdate);

    return () => {
      cleanupPaused();
      cleanupResumed();
      cleanupTimer();
    };
  }, [isConnected, on]);

  const loadData = async () => {
    try {
      const [activeSessions, allActivities, allOrders, allSessionsData] = await Promise.all([
        sessionsAPI.getActive(),
        activitiesAPI.getAll(),
        ordersAPI.getAll(200, 0).catch(() => []),
        sessionsAPI.getAll(200, 0).catch(() => ({ sessions: [] })),
      ]);

      const allSessions = (allSessionsData as any).sessions || allSessionsData || [];
      
      setSessions(allSessions);
      setOrders(allOrders || []);

      const stationsData: any[] = [];
      allActivities.forEach((activity: any) => {
        activity.units?.forEach((unit: any) => {
          const session = activeSessions.find(
            (s: any) => s.unitId === unit.id && (s.status === 'active' || s.status === 'paused')
          );
          stationsData.push({
            id: unit.id,
            name: unit.name,
            type: activity.id,
            status: session ? 'occupied' : 'available',
            currentCustomer: session ? {
              name: session.customerName,
              phone: session.customerPhone,
              startTime: new Date(session.startTime),
            } : undefined,
            rate: activity.baseRate,
            session: session ? {
              ...session,
              startTime: new Date(session.startTime),
              endTime: new Date(session.endTime),
              currentPauseStart: session.currentPauseStart ? new Date(session.currentPauseStart) : undefined,
              pauseHistory: (session.pauseHistory || []).map((p: any) => ({
                ...p,
                startTime: new Date(p.startTime),
                endTime: p.endTime ? new Date(p.endTime) : undefined,
              })),
            } : undefined,
          });
        });
      });

      setStations(stationsData);
    } catch (error: any) {
      console.error('Failed to load dashboard data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async (stationId: string) => {
    const session = sessions.find((s: any) => s.unitId === stationId && s.status === 'active');
    if (!session) {
      toast({
        title: "No Active Session",
        description: "No active session found for this station.",
        variant: "destructive",
      });
      return;
    }

    try {
      await sessionsAPI.pause(session.id, undefined, 'admin');
      toast({
        title: "Session Paused",
        description: "The session has been paused.",
      });
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to pause session.",
        variant: "destructive",
      });
    }
  };

  const handleResume = async (stationId: string) => {
    const session = sessions.find((s: any) => s.unitId === stationId && s.status === 'paused');
    if (!session) {
      toast({
        title: "No Paused Session",
        description: "No paused session found for this station.",
        variant: "destructive",
      });
      return;
    }

    try {
      await sessionsAPI.resume(session.id, 'admin');
      toast({
        title: "Session Resumed",
        description: "The session has been resumed.",
      });
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to resume session.",
        variant: "destructive",
      });
    }
  };

  const handleExtend = async (stationId: string) => {
    const session = sessions.find((s: any) => s.unitId === stationId && (s.status === 'active' || s.status === 'paused'));
    if (!session) {
      toast({
        title: "No Session",
        description: "No session found for this station.",
        variant: "destructive",
      });
      return;
    }

    if (session.status === 'paused') {
      toast({
        title: "Cannot Extend",
        description: "Please resume the session before extending.",
        variant: "destructive",
      });
      return;
    }

    try {
      await sessionsAPI.extend(session.id, 30);
      toast({
        title: "Session Extended",
        description: "Added 30 minutes to the session.",
      });
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to extend session.",
        variant: "destructive",
      });
    }
  };

  const handleEndSession = async (stationId: string) => {
    const session = sessions.find((s: any) => s.unitId === stationId && (s.status === 'active' || s.status === 'paused'));
    if (!session) {
      toast({
        title: "No Session",
        description: "No session found for this station.",
        variant: "destructive",
      });
      return;
    }

    try {
      await sessionsAPI.end(session.id);
      toast({
        title: "Session Ended",
        description: "Session has been ended.",
      });
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to end session.",
        variant: "destructive",
      });
    }
  };

  const handleAssign = (stationId: string) => {
    toast({
      title: "Assign Customer",
      description: "Select a customer from the queue.",
    });
  };

  const todaySessions = sessions.filter((s: any) => {
    if (!s.createdAt) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sessionDate = new Date(s.createdAt);
    sessionDate.setHours(0, 0, 0, 0);
    return sessionDate.getTime() === today.getTime();
  });

  const todayOrders = orders.filter((o: any) => {
    if (!o.createdAt) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const orderDate = new Date(o.createdAt);
    orderDate.setHours(0, 0, 0, 0);
    return orderDate.getTime() === today.getTime();
  });

  const revenueBreakdown = calculateRevenueBreakdown(todaySessions, todayOrders, true);
  const todayRevenue = calculateTotalRevenue(todaySessions, todayOrders, true);
  
  const pendingOrders = orders.filter((o: any) => 
    o.status === 'pending' || o.status === 'preparing' || o.status === 'ready'
  ).slice(0, 5);

  return (
    <AdminLayout>
      <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 mb-4"
          >
            <Activity className="w-5 h-5 text-success" />
            <h2 className="text-lg md:text-xl font-bold text-foreground">Live Stations</h2>
            <span className="w-2 h-2 bg-success rounded-full pulse-glow" />
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
            {stations.map((station, index) => (
              <motion.div
                key={station.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <StationCard
                  station={station}
                  session={station.session}
                  onExtend={() => handleExtend(station.id)}
                  onEndSession={() => handleEndSession(station.id)}
                  onAssign={() => handleAssign(station.id)}
                  onPause={() => handlePause(station.id)}
                  onResume={() => handleResume(station.id)}
                />
              </motion.div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <RevenueCard total={todayRevenue} breakdown={revenueBreakdown} />
          
          {pendingOrders.length > 0 && (
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-lg">Recent Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pendingOrders.map((order: any) => (
                    <div key={order.id} className="flex justify-between items-center text-sm">
                      <div>
                        <div className="font-medium">{order.customerName}</div>
                        <div className="text-muted-foreground text-xs">
                          {order.items?.length || 0} items • {order.status}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">₹{order.totalAmount}</div>
                        <div className={`text-xs ${
                          order.paymentStatus === 'paid' || order.paymentStatus === 'offline' 
                            ? 'text-success' 
                            : 'text-warning'
                        }`}>
                          {order.paymentStatus}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
