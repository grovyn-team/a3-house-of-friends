import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ordersAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { 
  ShoppingCart, 
  User, 
  Phone, 
  RefreshCw, 
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  Filter,
  ChevronLeft,
  ChevronRight,
  UtensilsCrossed
} from "lucide-react";
import { formatCurrency } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function OrderHistory() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadOrders();
  }, [offset, statusFilter]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const allOrders = await ordersAPI.getAll(limit * 10, 0);
      
      // Filter by status if needed
      let filtered = allOrders;
      if (statusFilter !== 'all') {
        filtered = allOrders.filter((o: any) => o.status === statusFilter);
      }
      
      // Apply pagination
      const paginated = filtered.slice(offset, offset + limit);
      
      const processed = paginated.map((o: any) => ({
        ...o,
        createdAt: new Date(o.createdAt),
      }));
      
      setOrders(processed);
      setTotal(filtered.length);
    } catch (error: any) {
      console.error('Failed to load order history:', error);
      toast({
        title: "Error",
        description: "Failed to load order history.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-warning/20 text-warning border-warning/30"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case 'preparing':
        return <Badge className="bg-primary/20 text-primary border-primary/30"><UtensilsCrossed className="w-3 h-3 mr-1" /> Preparing</Badge>;
      case 'ready':
        return <Badge className="bg-success/20 text-success border-success/30"><CheckCircle className="w-3 h-3 mr-1" /> Ready</Badge>;
      case 'served':
      case 'completed':
        return <Badge className="bg-success/20 text-success border-success/30"><CheckCircle className="w-3 h-3 mr-1" /> Completed</Badge>;
      case 'cancelled':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30"><XCircle className="w-3 h-3 mr-1" /> Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
      case 'offline':
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

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  if (loading && orders.length === 0) {
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
            <h1 className="text-3xl font-bold text-foreground">Order History</h1>
            <p className="text-muted-foreground mt-1">
              View all food and beverage orders
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Orders</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="preparing">Preparing</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="served">Served</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={loadOrders}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {orders.length === 0 ? (
          <Card className="glass text-center py-12">
            <CardContent>
              <p className="text-muted-foreground">No order history found.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="w-full max-w-4xl mx-auto">
              <div className="grid gap-4 w-full">
                {orders.map((order, index) => (
                  <motion.div
                    key={order.id}
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
                            <CardTitle className="text-lg">{order.customerName}</CardTitle>
                            {getStatusBadge(order.status)}
                            {getPaymentStatusBadge(order.paymentStatus)}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                            <div className="flex items-center gap-1">
                              <Phone className="w-4 h-4" />
                              {order.customerPhone}
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {formatDate(order.createdAt)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary">
                            {formatCurrency(order.totalAmount || 0)}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="bg-secondary/30 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Order Items</p>
                          <div className="space-y-1">
                            {order.items?.map((item: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between text-sm">
                                <span className="text-foreground">
                                  {item.quantity}x {item.name}
                                </span>
                                <span className="font-medium text-foreground">
                                  {formatCurrency((item.price || 0) * (item.quantity || 1))}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="bg-secondary/30 rounded-lg p-3">
                            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Items</p>
                            <p className="font-semibold text-foreground">
                              {order.items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0} items
                            </p>
                          </div>
                          <div className="bg-secondary/30 rounded-lg p-3">
                            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Order ID</p>
                            <p className="font-semibold text-foreground text-sm font-mono">
                              {order.id.slice(-8)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {offset + 1} to {Math.min(offset + limit, total)} of {total} orders
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
