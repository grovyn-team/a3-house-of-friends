import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CartItem, QRContext } from '@/lib/types';
import { formatCurrency } from '@/lib/types';
import { ordersAPI } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useBookingHistory } from '@/hooks/useBookingHistory';
import { useWebSocket } from '@/hooks/useWebSocket';
import Payment from './Payment';

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { addBooking } = useBookingHistory();
  const { emit, on, joinRoom, isConnected } = useWebSocket({ namespace: 'customer' });

  const cart = (location.state?.cart || []) as CartItem[];
  const qrContext = (location.state?.qrContext || {}) as QRContext;
  const sessionId = location.state?.sessionId as string | undefined;

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  const subtotal = cart.reduce((sum, item) => sum + item.menuItem.price * item.quantity, 0);
  const totalAmount = subtotal;

  // Register customer phone and listen for order status updates
  useEffect(() => {
    if (!isConnected || !customerPhone) return;

    // Register customer phone when entered
    const normalizedPhone = customerPhone.replace(/\D/g, '');
    if (normalizedPhone.length >= 10) {
      emit('register_customer', { phone: normalizedPhone });
    }

    // Listen for order status updates
    const cleanupOrder = on('order_status_update', (data: any) => {
      if (data.orderId) {
        toast({
          title: data.status === 'preparing' ? 'Order Being Prepared!' :
                 data.status === 'ready' ? 'Order Ready!' :
                 data.status === 'served' ? 'Order Served!' :
                 data.status === 'cancelled' ? 'Order Cancelled' : 'Order Updated',
          description: data.message || 'Your order status has been updated.',
          variant: data.status === 'cancelled' ? 'destructive' : 'default',
        });
        
        // Update booking history if order exists
        if (orderId && data.orderId === orderId) {
          // Status will be updated via booking history hook if needed
        }
      }
    });

    return () => {
      cleanupOrder();
    };
  }, [isConnected, customerPhone, emit, on, toast, orderId]);

  const updateQuantity = (itemId: string, delta: number) => {
    toast({
      title: 'Please go back to update cart',
      variant: 'destructive',
    });
  };

  const handleProceedToPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim() || !customerPhone.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please enter your name and phone number.',
        variant: 'destructive',
      });
      return;
    }

    if (customerPhone.replace(/\D/g, '').length < 10) {
      toast({
        title: 'Invalid Phone Number',
        description: 'Please enter a valid 10-digit phone number.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Create order first
      const order = await ordersAPI.create({
        items: cart.map(item => ({
          menuItemId: item.menuItem.id,
          quantity: item.quantity,
          notes: item.notes,
        })),
        customerName: customerName.trim(),
        customerPhone: customerPhone.replace(/\D/g, ''),
        qrContext,
        sessionId,
      });

      // Track order in history
      addBooking({
        id: order.id,
        type: 'order',
        customerName: customerName.trim(),
        customerPhone: customerPhone.replace(/\D/g, ''),
        amount: totalAmount,
        status: 'pending',
        createdAt: new Date().toISOString(),
        orderId: order.id,
      });

      // Register customer and join order room
      const normalizedPhone = customerPhone.replace(/\D/g, '');
      emit('register_customer', { phone: normalizedPhone });
      joinRoom(`order:${order.id}`);

      // Emit order created event to admin
      emit('order_created', {
        orderId: order.id,
        customerName: customerName.trim(),
        customerPhone: normalizedPhone,
        amount: totalAmount,
        itemCount: cart.length,
        qrContext,
        timestamp: new Date().toISOString(),
      });

      setOrderId(order.id);
      setShowPayment(true);
    } catch (error: any) {
      toast({
        title: 'Order Creation Failed',
        description: error.message || 'Could not create order. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (showPayment && orderId) {
    return (
      <Payment
        orderId={orderId}
        amount={totalAmount}
        customerName={customerName}
        customerPhone={customerPhone}
        qrContext={qrContext}
        sessionId={sessionId}
      />
    );
  }

  if (cart.length === 0) {
    return (
      <div className="min-h-screen gradient-mesh flex items-center justify-center p-4">
        <Card className="w-full max-w-md glass">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">Your cart is empty</p>
            <Button onClick={() => navigate('/menu', { state: { qrContext, sessionId } })}>
              Browse Menu
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-mesh">
      <div className="container max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/menu', { state: { qrContext, sessionId } })}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-foreground">
              Checkout
            </h1>
          </div>
        </div>

        <form onSubmit={handleProceedToPayment} className="space-y-6">
          {/* Customer Info */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg">Your Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="Enter your name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="flex gap-2">
                  <div className="flex items-center gap-2 px-4 bg-secondary rounded-lg text-muted-foreground text-sm shrink-0">
                    <span>🇮🇳</span>
                    <span>+91</span>
                  </div>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="10-digit number"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    required
                    className="flex-1 h-12"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order Summary */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cart.map((item) => (
                <div key={item.menuItem.id} className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-medium text-foreground">
                      {item.menuItem.name} × {item.quantity}
                    </div>
                  </div>
                  <div className="font-medium text-foreground">
                    {formatCurrency(item.menuItem.price * item.quantity)}
                  </div>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span>{formatCurrency(totalAmount)}</span>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" variant="glow" size="xl" className="w-full">
            Proceed to Payment
          </Button>
        </form>
      </div>
    </div>
  );
}

