import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { revenueAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, DollarSign, Download, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function Revenue() {
  const { toast } = useToast();
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({ totalRevenue: 0, sessionRevenue: 0, orderRevenue: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('today');
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    loadData();
  }, [dateFilter, pagination.page]);

  const getDateRange = (filter: 'today' | 'week' | 'month' | 'all') => {
    const now = new Date();
    let start: Date;
    let end = new Date();
    end.setHours(23, 59, 59, 999);

    if (filter === 'today') {
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
    } else if (filter === 'week') {
      start = new Date(now);
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
    } else if (filter === 'month') {
      start = new Date(now);
      start.setMonth(start.getMonth() - 1);
      start.setHours(0, 0, 0, 0);
    } else {
      start = new Date(0);
    }

    return {
      startDate: filter === 'all' ? undefined : start.toISOString().split('T')[0],
      endDate: filter === 'all' ? undefined : end.toISOString().split('T')[0],
    };
  };

  const loadData = async (page = pagination.page) => {
    try {
      setLoading(true);
      const { startDate, endDate } = getDateRange(dateFilter);
      const data = await revenueAPI.getData({
        startDate,
        endDate,
        page,
        limit: pagination.limit,
      });

      setRevenueData(data.data || []);
      setSummary(data.summary || {});
      setPagination(data.pagination || pagination);
    } catch (error: any) {
      console.error('Failed to load revenue data:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load revenue data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!exportStartDate || !exportEndDate) {
      toast({
        title: "Date Range Required",
        description: "Please select both start and end dates.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsExporting(true);
      await revenueAPI.exportData(exportStartDate, exportEndDate);
      toast({
        title: "Success",
        description: "Revenue data exported successfully.",
      });
      setIsExportDialogOpen(false);
      setExportStartDate('');
      setExportEndDate('');
    } catch (error: any) {
      toast({
        title: "Export Error",
        description: error.message || "Failed to export revenue data.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const getRevenueBreakdown = () => {
    const breakdown: { [key: string]: number } = {};
    revenueData.forEach((item: any) => {
      const category = item.category || 'Unknown';
      breakdown[category] = (breakdown[category] || 0) + (item.amount || 0);
    });
    return Object.entries(breakdown)
      .map(([label, amount]) => ({ label, amount }))
      .sort((a, b) => b.amount - a.amount);
  };

  const getDailyData = () => {
    const days: { [key: string]: { date: string; revenue: number } } = {};
    
    revenueData.forEach((item: any) => {
      const date = new Date(item.date);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      if (!days[dateStr]) {
        days[dateStr] = { date: dateStr, revenue: 0 };
      }
      days[dateStr].revenue += item.amount || 0;
    });
    
    return Object.values(days).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  };

  const revenueBreakdown = getRevenueBreakdown();
  const dailyData = getDailyData();

  if (loading && revenueData.length === 0) {
    return (
      <AdminLayout>
        <div className="text-center py-12">Loading revenue data...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold text-foreground">Revenue Tracking</h2>
          </div>
          <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Export Revenue Data</DialogTitle>
                <DialogDescription>
                  Select a date range to export revenue data to CSV format.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <div className="relative">
                      <Input
                        id="startDate"
                        type="date"
                        value={exportStartDate}
                        onChange={(e) => setExportStartDate(e.target.value)}
                        className="date-input-white"
                      />
                      <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date</Label>
                    <div className="relative">
                      <Input
                        id="endDate"
                        type="date"
                        value={exportEndDate}
                        onChange={(e) => setExportEndDate(e.target.value)}
                        className="date-input-white"
                      />
                      <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white pointer-events-none" />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsExportDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleExport} disabled={isExporting}>
                    {isExporting ? (
                      <>
                        <Download className="h-4 w-4 mr-2 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs value={dateFilter} onValueChange={(v) => {
          setDateFilter(v as any);
          setPagination({ ...pagination, page: 1 });
        }}>
          <TabsList className="grid w-full max-w-md grid-cols-4">
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="week">This Week</TabsTrigger>
            <TabsTrigger value="month">This Month</TabsTrigger>
            <TabsTrigger value="all">All Time</TabsTrigger>
          </TabsList>

          <TabsContent value={dateFilter} className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card className="glass">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">₹{summary.totalRevenue?.toLocaleString() || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {dateFilter === 'today' ? 'Today' : dateFilter === 'week' ? 'Last 7 days' : dateFilter === 'month' ? 'Last 30 days' : 'All time'}
                  </p>
                </CardContent>
              </Card>

              <Card className="glass">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Session Revenue</CardTitle>
                  <TrendingUp className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">₹{summary.sessionRevenue?.toLocaleString() || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {summary.sessionCount || 0} {summary.sessionCount === 1 ? 'session' : 'sessions'}
                  </p>
                </CardContent>
              </Card>

              <Card className="glass">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Food & Beverages</CardTitle>
                  <TrendingUp className="h-4 w-4 text-accent" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">₹{summary.orderRevenue?.toLocaleString() || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {summary.orderCount || 0} {summary.orderCount === 1 ? 'order' : 'orders'}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <Card className="glass">
                <CardHeader>
                  <CardTitle>Revenue Breakdown</CardTitle>
                  <CardDescription>By service category</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {revenueBreakdown.length > 0 ? (
                      revenueBreakdown.map((item, index) => (
                        <motion.div
                          key={item.label}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-center justify-between p-3 rounded-lg bg-card/50 border border-border/50"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-foreground">{item.label}</div>
                            <div className="text-sm text-muted-foreground">
                              {summary.totalRevenue > 0 ? ((item.amount / summary.totalRevenue) * 100).toFixed(1) : 0}% of total
                            </div>
                          </div>
                          <div className="text-lg font-bold text-primary">
                            ₹{item.amount.toLocaleString()}
                          </div>
                        </motion.div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">No revenue data available</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="glass">
                <CardHeader>
                  <CardTitle>Revenue Trend</CardTitle>
                  <CardDescription>Daily revenue over time</CardDescription>
                </CardHeader>
                <CardContent>
                  {dailyData.length > 0 ? (
                    <div className="space-y-3">
                      {dailyData.map((item, index) => {
                        const maxRevenue = Math.max(...dailyData.map(d => d.revenue));
                        const percentage = maxRevenue > 0 ? (item.revenue / maxRevenue) * 100 : 0;
                        return (
                          <motion.div
                            key={item.date}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="space-y-1"
                          >
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">{item.date}</span>
                              <span className="font-medium text-foreground">₹{item.revenue.toLocaleString()}</span>
                            </div>
                            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                transition={{ delay: index * 0.05 + 0.2, duration: 0.5 }}
                                className="h-full bg-primary rounded-full"
                              />
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">No data available</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {pagination.pages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div className="text-sm text-muted-foreground">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} transactions
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadData(pagination.page - 1)}
                    disabled={pagination.page === 1 || loading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                      let pageNum;
                      if (pagination.pages <= 5) {
                        pageNum = i + 1;
                      } else if (pagination.page <= 3) {
                        pageNum = i + 1;
                      } else if (pagination.page >= pagination.pages - 2) {
                        pageNum = pagination.pages - 4 + i;
                      } else {
                        pageNum = pagination.page - 2 + i;
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={pagination.page === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => loadData(pageNum)}
                          disabled={loading}
                          className="w-10"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadData(pagination.page + 1)}
                    disabled={pagination.page === pagination.pages || loading}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
