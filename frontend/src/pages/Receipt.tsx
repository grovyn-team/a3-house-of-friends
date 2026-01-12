import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, Share2, Receipt as ReceiptIcon, Calendar, Clock, User, Phone, CreditCard, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Logo } from '@/components/Logo';
import { sessionsAPI, ordersAPI } from '@/lib/api';
import { formatCurrency, formatDuration } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export default function Receipt() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [receiptData, setReceiptData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);
  const toastRef = useRef(toast);
  const navigateRef = useRef(navigate);

  // Update refs when they change
  useEffect(() => {
    toastRef.current = toast;
    navigateRef.current = navigate;
  }, [toast, navigate]);

  useEffect(() => {
    // Only run once - use ref to prevent re-runs
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Extract values from location.state
    const state = location.state;
    const session = state?.session;
    const order = state?.order;
    const sessionId = state?.sessionId;
    const orderId = state?.orderId;

    // Handle session from state
    if (session) {
      setReceiptData({ type: 'session', data: session });
      setLoading(false);
      return;
    }

    // Handle order from state
    if (order) {
      setReceiptData({ type: 'order', data: order });
      setLoading(false);
      return;
    }

    // Fetch session from API
    if (sessionId) {
      sessionsAPI.getById(sessionId)
        .then(sessionData => {
          setReceiptData({ type: 'session', data: sessionData });
          setLoading(false);
        })
        .catch(error => {
          console.error('Error loading session:', error);
          setLoading(false);
          toastRef.current({
            title: 'Error',
            description: 'Could not load receipt data.',
            variant: 'destructive',
          });
          // Use setTimeout to avoid navigation during render
          setTimeout(() => {
            navigateRef.current('/', { replace: true });
          }, 100);
        });
      return;
    }

    // Fetch order from API
    if (orderId) {
      ordersAPI.getById(orderId)
        .then(orderData => {
          setReceiptData({ type: 'order', data: orderData });
          setLoading(false);
        })
        .catch(error => {
          console.error('Error loading order:', error);
          setLoading(false);
          toastRef.current({
            title: 'Error',
            description: 'Could not load receipt data.',
            variant: 'destructive',
          });
          // Use setTimeout to avoid navigation during render
          setTimeout(() => {
            navigateRef.current('/', { replace: true });
          }, 100);
        });
      return;
    }

    // No data available
    setLoading(false);
    toastRef.current({
      title: 'No Receipt Data',
      description: 'No receipt information available.',
      variant: 'destructive',
    });
    // Use setTimeout to avoid navigation during render
    setTimeout(() => {
      navigateRef.current('/', { replace: true });
    }, 100);
  }, []); // Empty deps - only run once, refs prevent re-runs

  const handleDownload = () => {
    if (!receiptData) return;

    // Create a printable receipt
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const receipt = receiptData.data;
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - ${receipt.customerName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .details { margin: 20px 0; }
            .row { display: flex; justify-content: space-between; margin: 10px 0; }
            .total { font-size: 18px; font-weight: bold; margin-top: 20px; padding-top: 20px; border-top: 2px solid #000; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>a3houseoffriends</h1>
            <p>Digital Receipt</p>
          </div>
          <div class="details">
            <div class="row"><strong>Customer:</strong> ${receipt.customerName}</div>
            <div class="row"><strong>Phone:</strong> ${receipt.customerPhone}</div>
            <div class="row"><strong>Date:</strong> ${new Date(receipt.createdAt || receipt.startTime).toLocaleString('en-IN')}</div>
            ${receiptData.type === 'session' ? `
              <div class="row"><strong>Activity:</strong> ${receipt.activityId?.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'N/A'}</div>
              <div class="row"><strong>Duration:</strong> ${formatDuration(receipt.durationMinutes || receipt.duration || 0)}</div>
            ` : `
              <div class="row"><strong>Items:</strong> ${receipt.items?.length || 0}</div>
            `}
            <div class="row total"><strong>Total Amount:</strong> ${formatCurrency(receipt.amount || receipt.totalAmount || receipt.baseAmount || 0)}</div>
            <div class="row"><strong>Payment Status:</strong> ${receipt.paymentStatus || 'Paid'}</div>
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  const handleShare = async () => {
    if (!receiptData) return;

    const receipt = receiptData.data;
    const shareData = {
      title: 'Receipt - a3houseoffriends',
      text: `Receipt for ${receipt.customerName}\nAmount: ${formatCurrency(receipt.amount || receipt.totalAmount || receipt.baseAmount || 0)}`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        // User cancelled or error occurred
        console.error('Error sharing:', error);
      }
    } else {
      // Fallback: Copy to clipboard
      const text = `Receipt - a3houseoffriends\nCustomer: ${receipt.customerName}\nAmount: ${formatCurrency(receipt.amount || receipt.totalAmount || receipt.baseAmount || 0)}`;
      try {
        await navigator.clipboard.writeText(text);
        toast({
          title: 'Copied',
          description: 'Receipt details copied to clipboard.',
        });
      } catch (error) {
        console.error('Error copying to clipboard:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen gradient-mesh flex items-center justify-center">
        <div className="text-muted-foreground">Loading receipt...</div>
      </div>
    );
  }

  if (!receiptData) {
    return (
      <div className="min-h-screen gradient-mesh flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <h1 className="text-2xl font-bold text-foreground mb-2">No Receipt Data</h1>
          <p className="text-muted-foreground text-sm mb-4">No receipt information available.</p>
          <Button onClick={() => navigate('/', { replace: true })}>Go Home</Button>
        </motion.div>
      </div>
    );
  }

  const receipt = receiptData.data;
  const isSession = receiptData.type === 'session';

  return (
    <div className="min-h-screen gradient-mesh">
      <div className="container max-w-2xl mx-auto px-4 py-6 md:py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Header */}
          <div className="flex items-left gap-4 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="glass"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Logo size="md" />
          </div>

          {/* Receipt Card */}
          <Card className="glass-strong">
            <CardHeader className="text-center border-b border-border pb-4">
              <div className="flex items-center justify-center mb-2">
                <ReceiptIcon className="w-8 h-8 text-primary mr-2" />
                <CardTitle className="text-2xl">Receipt</CardTitle>
              </div>
              <CardDescription>
                {isSession ? 'Activity Session' : 'Food Order'}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {/* Business Info */}
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-foreground mb-1">a3houseoffriends</h2>
                <p className="text-sm text-muted-foreground">Gaming Zone & Cafeteria</p>
              </div>

              <Separator className="my-4" />

              {/* Customer Info */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Customer Name</p>
                    <p className="font-medium">{receipt.customerName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone Number</p>
                    <p className="font-medium">{receipt.customerPhone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Date & Time</p>
                    <p className="font-medium">
                      {new Date(receipt.createdAt || receipt.startTime).toLocaleString('en-IN', {
                        dateStyle: 'long',
                        timeStyle: 'short',
                      })}
                    </p>
                  </div>
                </div>
                {receipt.paymentId && (
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Transaction ID</p>
                      <p className="font-mono text-xs">{receipt.paymentId}</p>
                    </div>
                  </div>
                )}
              </div>

              <Separator className="my-4" />

              {/* Session Details */}
              {isSession && (
                <div className="space-y-3 mb-6">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Activity</p>
                    <p className="font-medium">
                      {receipt.activityId?.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'N/A'}
                    </p>
                  </div>
                  {receipt.startTime && (
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">Start Time</p>
                        <p className="font-medium">
                          {new Date(receipt.startTime).toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>
                  )}
                  {receipt.endTime && (
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">End Time</p>
                        <p className="font-medium">
                          {new Date(receipt.endTime).toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>
                  )}
                  {(receipt.durationMinutes || receipt.duration) && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Duration</p>
                      <p className="font-medium">
                        {formatDuration(receipt.durationMinutes || receipt.duration)}
                      </p>
                    </div>
                  )}
                  {receipt.totalPausedDuration && receipt.totalPausedDuration > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Total Break Time</p>
                      <p className="font-medium text-warning">
                        {formatDuration(receipt.totalPausedDuration)}
                      </p>
                    </div>
                  )}
                  {receipt.pauseHistory && receipt.pauseHistory.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <p className="text-sm text-muted-foreground mb-3 flex items-center gap-2">
                        <Pause className="w-4 h-4" />
                        Break History
                      </p>
                      <div className="space-y-2">
                        {receipt.pauseHistory.map((pause: any, index: number) => (
                          <div key={index} className="text-xs bg-secondary/20 rounded-lg p-2">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-medium text-foreground">
                                Break #{index + 1}
                              </span>
                              {pause.duration && (
                                <span className="text-muted-foreground">
                                  {formatDuration(pause.duration)}
                                </span>
                              )}
                            </div>
                            {pause.startTime && (
                              <div className="text-muted-foreground mb-1">
                                <span className="font-medium">Start:</span>{' '}
                                {new Date(pause.startTime).toLocaleString('en-IN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            )}
                            {pause.endTime && (
                              <div className="text-muted-foreground mb-1">
                                <span className="font-medium">End:</span>{' '}
                                {new Date(pause.endTime).toLocaleString('en-IN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            )}
                            {pause.reason && (
                              <div className="text-muted-foreground mt-1 italic">
                                &quot;{pause.reason}&quot;
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Order Details */}
              {!isSession && receipt.items && (
                <div className="mb-6">
                  <p className="text-sm text-muted-foreground mb-3">Items</p>
                  <div className="space-y-2">
                    {receipt.items.map((item: any, index: number) => (
                      <div key={index} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                        <div>
                          <p className="font-medium">{item.name || `Item ${index + 1}`}</p>
                          {item.notes && (
                            <p className="text-xs text-muted-foreground">{item.notes}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-medium">
                            {formatCurrency((item.price || 0) * (item.quantity || 1))}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity}x {formatCurrency(item.price || 0)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator className="my-4" />

              {/* Amount Summary */}
              <div className="space-y-2 mb-6">
                {isSession && receipt.baseAmount && receipt.extensionAmount && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Base Amount</span>
                      <span className="font-medium">{formatCurrency(receipt.baseAmount)}</span>
                    </div>
                    {receipt.extensionAmount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Extension</span>
                        <span className="font-medium">{formatCurrency(receipt.extensionAmount)}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-border">
                  <span className="text-lg font-bold">Total Amount</span>
                  <span className="text-2xl font-bold text-primary">
                    {formatCurrency(receipt.amount || receipt.totalAmount || receipt.baseAmount || receipt.finalAmount || 0)}
                  </span>
                </div>
              </div>

              {/* Payment Status */}
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg mb-6">
                <span className="text-sm text-muted-foreground">Payment Status</span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${receipt.paymentStatus === 'paid' || receipt.paymentStatus === 'offline'
                  ? 'bg-success/20 text-success'
                  : 'bg-warning/20 text-warning'
                  }`}>
                  {receipt.paymentStatus === 'paid' ? 'Paid' : receipt.paymentStatus === 'offline' ? 'Cash Payment' : 'Pending'}
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleDownload}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleShare}
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center text-xs text-muted-foreground">
            <p>Thank you for visiting a3houseoffriends!</p>
            <p className="mt-1">This is a digital receipt. No physical copy required.</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
