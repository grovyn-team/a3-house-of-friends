import { useState, useEffect } from "react";
import { ChefLayout } from "@/components/chef/ChefLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ordersAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/useWebSocket";
import { formatCurrency } from "@/lib/types";
import { 
  ChefHat, 
  Clock, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  UtensilsCrossed
} from "lucide-react";
import { motion } from "framer-motion";

export default function ChefOrders() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<Set<string>>(new Set());
  const authToken = localStorage.getItem('authToken');
  
  const { on, isConnected } = useWebSocket({ 
    namespace: 'admin',
    authToken: authToken || undefined,
  });

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await ordersAPI.getPendingOrders();
      setOrders(data || []);
    } catch (error: any) {
      console.error('Error loading orders:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load orders',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    if (!isConnected) return;

    const cleanupOrder = on('order_created', () => {
      loadOrders();
    });

    const cleanupStatus = on('queue_updated', () => {
      loadOrders();
    });

    return () => {
      cleanupOrder();
      cleanupStatus();
    };
  }, [isConnected, on]);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      setUpdating(prev => new Set(prev).add(orderId));
      await ordersAPI.updateOrderStatus(orderId, { status: newStatus });
      toast({
        title: 'Success',
        description: `Order status updated to ${newStatus}`,
      });
      await loadOrders();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update order status',
        variant: 'destructive',
      });
    } finally {
      setUpdating(prev => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "outline", label: "Pending" },
      preparing: { variant: "default", label: "Preparing" },
      ready: { variant: "secondary", label: "Ready" },
      served: { variant: "default", label: "Served" },
      cancelled: { variant: "destructive", label: "Cancelled" },
    };
    const config = variants[status] || { variant: "outline" as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getStatusActions = (order: any) => {
    const actions = [];
    if (order.status === 'pending') {
      actions.push(
        <Button
          key="preparing"
          size="sm"
          onClick={() => updateOrderStatus(order._id || order.id, 'preparing')}
          disabled={updating.has(order._id || order.id)}
        >
          <ChefHat className="h-4 w-4 mr-2" />
          Start Preparing
        </Button>
      );
    }
    if (order.status === 'preparing') {
      actions.push(
        <Button
          key="ready"
          size="sm"
          variant="secondary"
          onClick={() => updateOrderStatus(order._id || order.id, 'ready')}
          disabled={updating.has(order._id || order.id)}
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Mark Ready
        </Button>
      );
    }
    if (order.status === 'ready') {
      actions.push(
        <Button
          key="served"
          size="sm"
          onClick={() => updateOrderStatus(order._id || order.id, 'served')}
          disabled={updating.has(order._id || order.id)}
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Mark Served
        </Button>
      );
    }
    return actions;
  };

  const pendingOrders = orders.filter(o => ['pending', 'preparing', 'ready'].includes(o.status));
  const completedOrders = orders.filter(o => ['served', 'cancelled'].includes(o.status));

  return (
    <ChefLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Kitchen Orders</h1>
            <p className="text-muted-foreground">Manage and update order status in real-time</p>
          </div>
          <Button variant="outline" onClick={loadOrders} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12">Loading orders...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Pending</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-500">
                    {pendingOrders.filter(o => o.status === 'pending').length}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Preparing</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-500">
                    {pendingOrders.filter(o => o.status === 'preparing').length}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Ready</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-500">
                    {pendingOrders.filter(o => o.status === 'ready').length}
                  </div>
                </CardContent>
              </Card>
            </div>

            {pendingOrders.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Active Orders</h2>
                {pendingOrders.map((order) => (
                  <motion.div
                    key={order._id || order.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <UtensilsCrossed className="h-5 w-5 text-orange-500" />
                            <div>
                              <CardTitle className="text-lg">Order #{order._id?.toString().slice(-6) || order.id}</CardTitle>
                              <p className="text-sm text-muted-foreground mt-1">
                                {order.customerName} • {order.customerPhone}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(order.status)}
                            <span className="text-lg font-bold">{formatCurrency(order.totalAmount)}</span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="space-y-2">
                            {order.items?.map((item: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                                <div>
                                  <p className="font-medium">{item.name || item.menuItem?.name}</p>
                                  {item.notes && (
                                    <p className="text-sm text-muted-foreground">Note: {item.notes}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className="text-sm">Qty: {item.quantity}</span>
                                  <span className="font-medium">{formatCurrency((item.price || item.menuItem?.price || 0) * item.quantity)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="h-4 w-4" />
                              {new Date(order.createdAt).toLocaleTimeString()}
                            </div>
                            <div className="flex gap-2">
                              {getStatusActions(order)}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}

            {completedOrders.length > 0 && (
              <div className="space-y-4 mt-8">
                <h2 className="text-lg font-semibold">Recent Completed</h2>
                {completedOrders.slice(0, 5).map((order) => (
                  <Card key={order._id || order.id} className="opacity-75">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base">Order #{order._id?.toString().slice(-6) || order.id}</CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">{order.customerName}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(order.status)}
                          <span className="font-medium">{formatCurrency(order.totalAmount)}</span>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}

            {orders.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <UtensilsCrossed className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No orders at the moment</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </ChefLayout>
  );
}
