import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { sessionsAPI, activitiesAPI } from '@/lib/api';
import { Session, QRContext } from '@/lib/types';
import { formatCurrency, formatDuration } from '@/lib/types';
import { calculateActivityPrice, isPeakHour } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';

export default function ExtendSession() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const session = location.state?.session as Session | undefined;
  const qrContext = (location.state?.qrContext || {}) as QRContext;

  const [activity, setActivity] = useState<any | null>(null);
  const [extensionMinutes, setExtensionMinutes] = useState(30);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      navigate('/');
      return;
    }

    loadActivity();
  }, [session, navigate]);

  const loadActivity = async () => {
    if (!session) return;

    try {
      setLoading(true);
      const data = await activitiesAPI.getById(session.activityId);
      setActivity(data);
    } catch (error: any) {
      toast({
        title: 'Error loading activity',
        description: error.message,
        variant: 'destructive',
      });
      navigate('/session', { state: { session } });
    } finally {
      setLoading(false);
    }
  };

  if (loading || !session || !activity) {
    return (
      <div className="min-h-screen gradient-mesh flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const peak = isPeakHour();
  const extensionPrice = calculateActivityPrice(activity, extensionMinutes, peak);
  const durationStep = activity.pricingType === 'per-hour' ? 30 : 15;

  const handleDurationChange = (delta: number) => {
    const newDuration = extensionMinutes + delta;
    if (newDuration >= durationStep) {
      setExtensionMinutes(newDuration);
    }
  };

  const handleExtend = async () => {
    setIsSubmitting(true);

    try {
      await sessionsAPI.extend(session.id, extensionMinutes);
      
      // Get updated session
      const updatedSession = await sessionsAPI.getById(session.id);

      toast({
        title: 'Session Extended',
        description: `Added ${formatDuration(extensionMinutes)} to your session.`,
      });

      sessionStorage.setItem('currentSession', JSON.stringify(updatedSession));
      navigate('/session', {
        state: { session: updatedSession },
      });
    } catch (error: any) {
      toast({
        title: 'Extension Failed',
        description: error.message || 'Could not extend session. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen gradient-mesh">
      <div className="container max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/session', { state: { session } })}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-foreground">
              Extend Session
            </h1>
            <p className="text-sm text-muted-foreground">
              Add more time to your booking
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Current Session Info */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg">Current Session</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Activity</span>
                <span className="text-foreground">{activity.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Duration</span>
                <span className="text-foreground">{formatDuration(session.duration)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Extension Duration */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg">Add Duration</CardTitle>
              <CardDescription>
                Minimum: {formatDuration(durationStep)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleDurationChange(-durationStep)}
                  disabled={extensionMinutes <= durationStep}
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <div className="text-center">
                  <div className="text-3xl font-semibold text-foreground mb-1">
                    {formatDuration(extensionMinutes)}
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

          {/* Price Summary */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg">Price Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Extension: {formatDuration(extensionMinutes)}
                </span>
                <span className="text-foreground">
                  {formatCurrency(extensionPrice)}
                </span>
              </div>
              {peak && activity.peakMultiplier && (
                <div className="text-xs text-muted-foreground">
                  Peak hour pricing applies
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span>{formatCurrency(extensionPrice)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <Button
            variant="glow"
            size="xl"
            className="w-full"
            onClick={handleExtend}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Processing...' : `Extend Session - ${formatCurrency(extensionPrice)}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

