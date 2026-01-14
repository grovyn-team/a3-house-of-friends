import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, X, Users, Clock, Gamepad2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ACTIVITIES, ActivityType } from '@/lib/constants';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface ChallengeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ChallengeFormData) => Promise<void>;
  loading?: boolean;
}

export interface ChallengeFormData {
  players: Array<{ name: string; phone?: string }>;
  activityId: string;
  activityType: ActivityType;
  duration: number; // in minutes
  customDuration: number;
}

export function ChallengeForm({ open, onOpenChange, onSubmit, loading }: ChallengeFormProps) {
  const { toast } = useToast();
  const [players, setPlayers] = useState<Array<{ name: string; phone?: string }>>([
    { name: '', phone: '' }
  ]);
  const [selectedActivity, setSelectedActivity] = useState<ActivityType | ''>('');
  const [durationType, setDurationType] = useState<'custom' | '30' | '60' | '90' | '120'>('custom');
  const [customDuration, setCustomDuration] = useState<number>(60);

  const handleAddPlayer = () => {
    setPlayers([...players, { name: '', phone: '' }]);
  };

  const handleRemovePlayer = (index: number) => {
    if (players.length > 1) {
      setPlayers(players.filter((_, i) => i !== index));
    }
  };

  const handlePlayerChange = (index: number, field: 'name' | 'phone', value: string) => {
    const updated = [...players];
    updated[index] = { ...updated[index], [field]: value };
    setPlayers(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate players
    const validPlayers = players.filter(p => p.name.trim());
    if (validPlayers.length < 2) {
      toast({
        title: "Validation Error",
        description: "Please add at least 2 players",
        variant: "destructive",
      });
      return;
    }

    if (!selectedActivity) {
      toast({
        title: "Validation Error",
        description: "Please select a game",
        variant: "destructive",
      });
      return;
    }

    const activity = ACTIVITIES.find(a => a.id === selectedActivity);
    if (!activity) {
      toast({
        title: "Validation Error",
        description: "Invalid activity selected",
        variant: "destructive",
      });
      return;
    }

    const duration = durationType === 'custom' 
      ? customDuration 
      : parseInt(durationType);

    if (duration < 15 || duration > 480) {
      toast({
        title: "Validation Error",
        description: "Duration must be between 15 minutes and 8 hours",
        variant: "destructive",
      });
      return;
    }

    await onSubmit({
      players: validPlayers,
      activityId: activity.id,
      activityType: selectedActivity,
      duration,
      customDuration,
    });
  };

  const handleClose = () => {
    if (!loading) {
      setPlayers([{ name: '', phone: '' }]);
      setSelectedActivity('');
      setDurationType('custom');
      setCustomDuration(60);
      onOpenChange(false);
    }
  };

  // Responsive width, always centered - use same format as default DialogContent
  const contentClass = "glass-ios border-primary/30 w-[95vw] md:w-full max-w-md md:max-w-2xl max-h-[90vh] overflow-y-auto p-4";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={contentClass}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Gamepad2 className="w-5 h-5 text-primary" />
            Challenge Your Friends
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Create a challenge session where the winner pays for everyone
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Players Section */}
          <Card className="glass border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Players
              </CardTitle>
              <CardDescription>Add at least 2 players to start a challenge</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {players.map((player, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex gap-2"
                >
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                    <Input
                      placeholder={`Player ${index + 1} Name *`}
                      value={player.name}
                      onChange={(e) => handlePlayerChange(index, 'name', e.target.value)}
                      required
                      disabled={loading}
                    />
                    <Input
                      placeholder="Phone (Optional)"
                      value={player.phone || ''}
                      onChange={(e) => handlePlayerChange(index, 'phone', e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  {players.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemovePlayer(index)}
                      disabled={loading}
                      className="flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </motion.div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={handleAddPlayer}
                disabled={loading}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Player
              </Button>
            </CardContent>
          </Card>

          {/* Game Selection */}
          <Card className="glass border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Gamepad2 className="w-5 h-5 text-primary" />
                Select Game
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedActivity}
                onValueChange={(value) => setSelectedActivity(value as ActivityType)}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a game" />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITIES.filter(a => a.enabled).map((activity) => {
                    // Get icon based on activity id
                    const getActivityIcon = (id: string) => {
                      if (id.includes('snooker')) return '🎱';
                      if (id.includes('playstation')) return '🎮';
                      if (id.includes('racing')) return '🏎️';
                      return '🎯';
                    };
                    return (
                      <SelectItem key={activity.id} value={activity.id}>
                        <span className="flex items-center gap-2">
                          <span>{getActivityIcon(activity.id)}</span>
                          <span>{activity.name}</span>
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Duration Selection */}
          <Card className="glass border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Session Duration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {['30', '60', '90', '120'].map((mins) => (
                  <Button
                    key={mins}
                    type="button"
                    variant={durationType === mins ? 'default' : 'outline'}
                    onClick={() => setDurationType(mins as any)}
                    disabled={loading}
                  >
                    {mins} min
                  </Button>
                ))}
              </div>
              <Button
                type="button"
                variant={durationType === 'custom' ? 'default' : 'outline'}
                onClick={() => setDurationType('custom')}
                disabled={loading}
                className="w-full"
              >
                Custom Duration
              </Button>
              {durationType === 'custom' && (
                <div className="space-y-2">
                  <Label htmlFor="customDuration">Duration (minutes)</Label>
                  <Input
                    id="customDuration"
                    type="number"
                    min="15"
                    max="480"
                    step="15"
                    value={customDuration}
                    onChange={(e) => setCustomDuration(parseInt(e.target.value) || 60)}
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum: 15 minutes, Maximum: 8 hours (480 minutes)
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="glow"
              disabled={loading}
              className="flex-1"
            >
              {loading ? 'Starting Challenge...' : 'Start Challenge'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
