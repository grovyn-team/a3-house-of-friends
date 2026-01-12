import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/Logo';

export default function SmokingRoom() {
  const navigate = useNavigate();
  const [showAgeDialog, setShowAgeDialog] = useState(true);
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  const handleAgeConfirm = (confirmed: boolean) => {
    setShowAgeDialog(false);
    if (confirmed) {
      setAgeConfirmed(true);
    } else {
      navigate('/');
    }
  };

  if (!ageConfirmed) {
    return (
      <AlertDialog open={showAgeDialog} onOpenChange={() => {}}>
        <AlertDialogContent className="glass">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Age Verification Required
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              <p className="font-medium text-foreground">
                Are you 18 years or older?
              </p>
              <div className="bg-muted/50 p-3 rounded-lg text-sm">
                <p className="text-muted-foreground">
                  <strong>Disclaimer:</strong> Smoking is injurious to health. Entry allowed only for customers aged 18 years and above.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleAgeConfirm(false)}>
              No
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => handleAgeConfirm(true)}>
              Yes, I am 18+
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <div className="min-h-screen gradient-mesh">
      <div className="container max-w-lg mx-auto px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Header */}
          <header className="text-center space-y-3">
            <Logo size="lg" className="justify-center" />
            <h1 className="text-2xl font-semibold text-foreground">
              Smoking Room
            </h1>
          </header>

          {/* Disclaimer Card */}
          <Card className="glass border-warning/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-warning">
                <AlertTriangle className="w-5 h-5" />
                Important Notice
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm leading-relaxed">
                Smoking is injurious to health. Entry allowed only for customers aged 18 years and above.
                Please be considerate of other customers and maintain cleanliness.
              </CardDescription>
            </CardContent>
          </Card>

          {/* Access Info */}
          <Card className="glass">
            <CardHeader>
              <CardTitle>Access Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-muted-foreground">
                <p>You have been granted access to the smoking room.</p>
                <p className="mt-2">
                  Please follow all safety guidelines and dispose of smoking materials properly.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full glass"
              onClick={() => navigate('/')}
            >
              <X className="w-4 h-4 mr-2" />
              Return to Home
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

