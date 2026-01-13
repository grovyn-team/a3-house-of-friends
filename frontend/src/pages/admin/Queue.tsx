import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { QueueItemCard } from "@/components/admin/QueueItemCard";
import { ServiceType, SERVICES } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Users, Gamepad2, UtensilsCrossed, Car, CircleDot, Coffee, PartyPopper } from "lucide-react";
import { queueAPI } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useConfirmation } from "@/components/ui/confirmation-dialog";

type FilterType = ServiceType | 'all';
type TabType = 'all' | 'bookings' | 'orders';

// Get icon component based on service type
const getServiceIcon = (serviceId: ServiceType | string): React.ReactElement => {
  const iconClass = "h-4 w-4";
  const serviceLower = serviceId.toLowerCase();
  
  if (serviceLower === 'playstation') {
    return <Gamepad2 className={iconClass} />;
  } else if (serviceLower === 'racing') {
    return <Car className={iconClass} />;
  } else if (serviceLower === 'snooker') {
    return <CircleDot className={iconClass} />;
  } else if (serviceLower === 'general') {
    return <Coffee className={iconClass} />;
  } else {
    return <CircleDot className={iconClass} />;
  }
};

export default function AdminQueue() {
  const { toast } = useToast();
  const { confirm, ConfirmationDialog } = useConfirmation();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [allQueue, setAllQueue] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const authToken = localStorage.getItem('authToken');
  const { on, isConnected } = useWebSocket({ 
    namespace: 'admin',
    authToken: authToken || undefined,
  });

  // Load queue data
  const loadQueue = useCallback(async () => {
    try {
      setRefreshing(true);
      const response = await queueAPI.getQueue(); // Load all data
      setAllQueue(response.queue || []);
      setStats(response.stats);
    } catch (error: any) {
      console.error('Error loading queue:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load queue data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  // Listen for real-time updates
  useEffect(() => {
    if (!isConnected) return;

    const cleanupBooking = on('booking_created', () => {
      loadQueue();
    });

    const cleanupOrder = on('order_created', () => {
      loadQueue();
    });

    const cleanupPayment = on('payment_completed', () => {
      loadQueue();
    });

    const cleanupQueueUpdate = on('queue_updated', () => {
      loadQueue();
    });

    const cleanupPendingApproval = on('pending_approval', () => {
      loadQueue();
    });

    const cleanupApprovalProcessed = on('approval_processed', () => {
      loadQueue();
    });

    return () => {
      cleanupBooking();
      cleanupOrder();
      cleanupPayment();
      cleanupQueueUpdate();
      cleanupPendingApproval();
      cleanupApprovalProcessed();
    };
  }, [isConnected, on, loadQueue]);

  // Filter queue based on tab and service filter
  const getFilteredQueue = () => {
    let filtered = [...allQueue];

    // Filter by tab (bookings vs orders)
    if (activeTab === 'bookings') {
      filtered = filtered.filter(entry => entry.type === 'reservation' || entry.type === 'session');
    } else if (activeTab === 'orders') {
      filtered = filtered.filter(entry => entry.type === 'order');
    }

    // Filter by service type
    if (activeFilter !== 'all') {
      filtered = filtered.filter(entry => entry.service === activeFilter);
    }

    // Recalculate positions
    return filtered.map((entry, index) => ({
      ...entry,
      position: index + 1,
    }));
  };

  const filteredQueue = getFilteredQueue();

  // Calculate tab counts
  const bookingsCount = allQueue.filter(e => e.type === 'reservation' || e.type === 'session').length;
  const ordersCount = allQueue.filter(e => e.type === 'order').length;

  const filters: { id: FilterType; label: string; icon?: React.ReactElement; count: number }[] = [
    { id: 'all', label: 'All', icon: <Users className="h-4 w-4" />, count: stats?.total || 0 },
    ...SERVICES.filter(s => s.id !== 'general').map(s => ({
      id: s.id as ServiceType,
      label: s.name,
      icon: getServiceIcon(s.id),
      count: stats?.byService?.[s.id] || 0,
    })),
    { id: 'general' as ServiceType, label: 'Cafe', icon: getServiceIcon('general'), count: stats?.byService?.general || 0 },
  ];

  const handleAssign = async (entry: any) => {
    try {
      // For pending_approval reservations, use approval endpoint
      if (entry.type === 'reservation' && entry.reservationStatus === 'pending_approval') {
        await queueAPI.approveCashPayment(entry.id);
        toast({
          title: "Payment Approved",
          description: "Cash payment approved and session started.",
        });
      } else {
        await queueAPI.assign(entry.id, entry.type);
        toast({
          title: "Customer Assigned",
          description: entry.type === 'reservation' 
            ? "Reservation confirmed and session started."
            : entry.type === 'order'
            ? "Order confirmed."
            : "Session activated.",
        });
      }
      // Reload queue to reflect changes
      loadQueue();
    } catch (error: any) {
      toast({
        title: "Assignment Failed",
        description: error.message || "Could not assign customer.",
        variant: "destructive",
      });
    }
  };

  const handleRemove = async (entry: any) => {
    confirm({
      title: "Remove from Queue?",
      description: `Are you sure you want to remove ${entry.name} from the queue?`,
      variant: "destructive",
      confirmText: "Remove",
      cancelText: "Cancel",
      onConfirm: async () => {
        try {
          await queueAPI.remove(entry.id, entry.type);
          toast({
            title: "Removed from Queue",
            description: entry.type === 'reservation'
              ? "Reservation cancelled."
              : entry.type === 'order'
              ? "Order cancelled."
              : "Session ended.",
            variant: "destructive",
          });
          // Reload queue to reflect changes
          loadQueue();
        } catch (error: any) {
          toast({
            title: "Removal Failed",
            description: error.message || "Could not remove from queue.",
            variant: "destructive",
          });
          throw error; // Re-throw to prevent dialog from closing
        }
      },
    });
  };

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" />
          <h2 className="text-lg md:text-xl font-bold text-foreground">Queue Management</h2>
        </div>
        <button
          onClick={loadQueue}
          disabled={refreshing}
          className="p-2 rounded-lg hover:bg-secondary transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="sr-only">Refresh</span>
        </button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabType)} className="mb-6">
        <TabsList className="grid w-full grid-cols-3 mb-4 bg-muted/50">
          <TabsTrigger value="all" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Users className="w-4 h-4" />
            All
            <span className="ml-1 px-1.5 py-0.5 rounded-md bg-background/50 text-xs font-medium">
              {allQueue.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="bookings" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Gamepad2 className="w-4 h-4" />
            Game Bookings
            <span className="ml-1 px-1.5 py-0.5 rounded-md bg-background/50 text-xs font-medium">
              {bookingsCount}
            </span>
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <UtensilsCrossed className="w-4 h-4" />
            Food Orders
            <span className="ml-1 px-1.5 py-0.5 rounded-md bg-background/50 text-xs font-medium">
              {ordersCount}
            </span>
          </TabsTrigger>
        </TabsList>

        {/* Service Filters */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-border"
        >
          {filters.map((filter) => {
            // Calculate count for current tab
            let count = 0;
            if (activeTab === 'all') {
              count = filter.count;
            } else if (activeTab === 'bookings') {
              count = allQueue.filter(e => 
                (e.type === 'reservation' || e.type === 'session') && 
                e.service === filter.id
              ).length;
            } else if (activeTab === 'orders') {
              count = allQueue.filter(e => 
                e.type === 'order' && 
                e.service === filter.id
              ).length;
            }

            return (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all text-sm border-2",
                  activeFilter === filter.id
                    ? "bg-primary text-primary-foreground border-primary shadow-lg"
                    : "bg-card/50 text-foreground border-border/50 hover:border-primary/40 hover:bg-card"
                )}
              >
                {filter.icon && (
                  <span className={cn(
                    "flex items-center",
                    activeFilter === filter.id ? "text-primary-foreground" : "text-primary/70"
                  )}>
                    {filter.icon}
                  </span>
                )}
                <span className={cn(
                  activeFilter === filter.id ? "text-primary-foreground" : "text-foreground"
                )}>
                  {filter.label}
                </span>
                <span className={cn(
                  "px-2 py-0.5 rounded-md text-xs font-bold min-w-[24px] text-center",
                  activeFilter === filter.id
                    ? "bg-primary-foreground/25 text-primary-foreground"
                    : "bg-muted/80 text-foreground"
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </motion.div>

        {/* Tab Content */}
        <TabsContent value="all" className="mt-0">
          <QueueGrid queue={filteredQueue} loading={loading} onAssign={handleAssign} onRemove={handleRemove} />
        </TabsContent>
        <TabsContent value="bookings" className="mt-0">
          <QueueGrid queue={filteredQueue} loading={loading} onAssign={handleAssign} onRemove={handleRemove} />
        </TabsContent>
        <TabsContent value="orders" className="mt-0">
          <QueueGrid queue={filteredQueue} loading={loading} onAssign={handleAssign} onRemove={handleRemove} />
        </TabsContent>
      </Tabs>

      <ConfirmationDialog />
    </AdminLayout>
  );
}

// Queue Grid Component
function QueueGrid({ 
  queue, 
  loading, 
  onAssign, 
  onRemove 
}: { 
  queue: any[]; 
  loading: boolean; 
  onAssign: (entry: any) => void; 
  onRemove: (entry: any) => void;
}) {
  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-muted-foreground">Loading queue...</div>
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-12 md:py-16"
      >
        <div className="flex justify-center mb-4">
          <PartyPopper className="w-12 h-12 md:w-16 md:h-16 text-primary/60" />
        </div>
        <h3 className="text-lg md:text-xl font-bold text-foreground mb-2">No one waiting!</h3>
        <p className="text-muted-foreground text-sm md:text-base">Queue is empty for this category.</p>
      </motion.div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
      {queue.map((entry, index) => (
        <motion.div
          key={entry.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <QueueItemCard
            entry={entry}
            onAssign={() => onAssign(entry)}
            onRemove={() => onRemove(entry)}
          />
        </motion.div>
      ))}
    </div>
  );
}
