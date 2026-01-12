import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, ArrowLeft, ArrowRight, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Logo } from '@/components/Logo';
import { activitiesAPI, reservationsAPI } from '@/lib/api';
import { ActivityType, QRContext, BookingRequest } from '@/lib/types';
import { formatCurrency, formatDuration } from '@/lib/types';
import { calculateActivityPrice, isPeakHour } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { useBookingHistory } from '@/hooks/useBookingHistory';
import { useWebSocket } from '@/hooks/useWebSocket';

export default function BookActivity() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { addBooking } = useBookingHistory();
  const { emit, on, joinRoom, isConnected } = useWebSocket({ namespace: 'customer' });
  
  const activityId = searchParams.get('activity') as ActivityType | null;
  const qrContext = (location.state?.qrContext || {}) as QRContext;
  
  const [activity, setActivity] = useState<any | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [duration, setDuration] = useState(30);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activityId) {
      toast({
        title: 'Invalid Activity',
        description: 'Please select an activity from the home page.',
        variant: 'destructive',
      });
      navigate('/');
      return;
    }

    loadActivity();
  }, [activityId, navigate, toast]);

  const loadActivity = async () => {
    try {
      setLoading(true);
      const data = await activitiesAPI.getById(activityId!);
      setActivity(data);
      setDuration(data.minimumDuration || 30);
    } catch (error: any) {
      toast({
        title: 'Error loading activity',
        description: error.message,
        variant: 'destructive',
      });
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !activity) {
    return (
      <div className="min-h-screen gradient-mesh flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const availableUnits = activity.units?.filter((u: any) => u.status === 'available') || [];
  const peak = isPeakHour();
  const price = calculateActivityPrice(activity, duration, peak);
  const canDecrease = duration > activity.minimumDuration;
  const durationStep = activity.pricingType === 'per-hour' ? 30 : 15;

  const handleDurationChange = (delta: number) => {
    const newDuration = duration + delta;
    if (newDuration >= activity.minimumDuration) {
      setDuration(newDuration);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
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

    if (availableUnits.length === 0) {
      toast({
        title: 'No Units Available',
        description: 'All units for this activity are currently occupied.',
        variant: 'destructive',
      });
      return;
    }

    const unitToBook = selectedUnitId || availableUnits[0].id;

    setIsSubmitting(true);

    try {
      // Create reservation (15-minute hold)
      const reservation = await reservationsAPI.create({
        activityId: activity.id,
        unitId: unitToBook,
        startTime: new Date().toISOString(),
        duration,
        customerName: customerName.trim(),
        customerPhone: customerPhone.replace(/\D/g, ''),
        qrContext,
      });

      // Track booking in history
      addBooking({
        id: reservation.id,
        type: 'reservation',
        name: activity.name,
        customerName: customerName.trim(),
        customerPhone: customerPhone.replace(/\D/g, ''),
        status: 'pending_payment',
        createdAt: new Date().toISOString(),
      });

      // Register customer and join reservation room
      const normalizedPhone = customerPhone.replace(/\D/g, '');
      emit('register_customer', { phone: normalizedPhone });
      joinRoom(`reservation:${reservation.id}`);

      // Emit booking event to admin
      emit('booking_created', {
        reservationId: reservation.id,
        activityId: activity.id,
        activityName: activity.name,
        customerName: customerName.trim(),
        customerPhone: normalizedPhone,
        amount: price,
        duration,
        qrContext,
        timestamp: new Date().toISOString(),
      });

      // Navigate to payment page
      navigate('/payment', {
        state: {
          reservationId: reservation.id,
          amount: price,
          activity,
          bookingRequest: {
            activityId: activity.id,
            unitId: unitToBook,
            duration,
            customerName: customerName.trim(),
            customerPhone: customerPhone.replace(/\D/g, ''),
            qrContext,
          },
        },
      });
    } catch (error: any) {
      toast({
        title: 'Booking Failed',
        description: error.message || 'Could not create booking. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen gradient-mesh">
      <div className="container max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-foreground">
              Book {activity.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {activity.description}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Information */}
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
                  <div className="flex items-center gap-2 px-4 rounded-lg text-muted-foreground text-sm shrink-0">
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

          {/* Duration Selection */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg">Duration</CardTitle>
              <CardDescription>
                Minimum booking: {formatDuration(activity.minimumDuration)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleDurationChange(-durationStep)}
                  disabled={!canDecrease}
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <div className="text-center">
                  <div className="text-3xl font-semibold text-foreground mb-1">
                    {formatDuration(duration)}
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                    <Clock className="w-4 h-4" />
                    {activity.pricingType === 'per-minute' && 'Per minute'}
                    {activity.pricingType === 'per-hour' && 'Per hour'}
                    {activity.pricingType === 'fixed-duration' && 'Fixed duration'}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleDurationChange(durationStep)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Unit Selection (if multiple available) */}
          {availableUnits.length > 1 && (
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-lg">Select Unit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {availableUnits.map((unit: any) => (
                    <Button
                      key={unit.id}
                      type="button"
                      variant={selectedUnitId === unit.id ? 'default' : 'outline'}
                      onClick={() => setSelectedUnitId(unit.id)}
                      className="h-auto py-3"
                    >
                      {unit.name}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Price Summary */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg">Price Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {formatDuration(duration)} × {formatCurrency(activity.baseRate)}
                  {activity.pricingType === 'per-hour' && '/hr'}
                  {activity.pricingType === 'per-minute' && '/min'}
                </span>
                <span className="text-foreground">
                  {formatCurrency(calculateActivityPrice(activity, duration, false))}
                </span>
              </div>
              {peak && activity.peakMultiplier && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Peak hour surcharge</span>
                  <span className="text-foreground">
                    +{formatCurrency(price - calculateActivityPrice(activity, duration, false))}
                  </span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span>{formatCurrency(price)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <Button
            type="submit"
            variant="glow"
            size="xl"
            className="w-full"
            disabled={isSubmitting || availableUnits.length === 0}
          >
            {isSubmitting ? (
              'Processing...'
            ) : (
              <>
                Continue to Payment
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

