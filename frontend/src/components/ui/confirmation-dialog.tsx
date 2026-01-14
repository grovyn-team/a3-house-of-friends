import { useState, useCallback, useRef } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmationOptions {
  title?: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

export function useConfirmation() {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmationOptions | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const isClosingRef = useRef(false);

  const confirm = useCallback((opts: ConfirmationOptions) => {
    // Reset closing flag when opening a new dialog
    isClosingRef.current = false;
    setOptions(opts);
    setIsOpen(true);
  }, []);

  const handleConfirm = async () => {
    if (!options || isProcessing || isClosingRef.current) return;
    
    setIsProcessing(true);
    try {
      await options.onConfirm();
      isClosingRef.current = true;
      setIsOpen(false);
      // Clear options after a short delay to prevent flickering
      setTimeout(() => {
        setOptions(null);
        isClosingRef.current = false;
      }, 100);
    } catch (error) {
      console.error("Confirmation action failed:", error);
      // Don't close on error, let user try again
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = useCallback(() => {
    if (isClosingRef.current || isProcessing) return;
    
    isClosingRef.current = true;
    if (options?.onCancel) {
      options.onCancel();
    }
    setIsOpen(false);
    // Clear options after a short delay to prevent flickering
    setTimeout(() => {
      setOptions(null);
      isClosingRef.current = false;
    }, 100);
  }, [options, isProcessing]);

  const handleOpenChange = useCallback((open: boolean) => {
    // Only handle close events, and only if not already closing
    if (!open && !isClosingRef.current && !isProcessing) {
      handleCancel();
    }
  }, [handleCancel, isProcessing]);

  const ConfirmationDialog = () => {
    if (!options) return null;

    return (
      <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {options.title || "Confirm Action"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {options.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel} disabled={isProcessing}>
              {options.cancelText || "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={isProcessing}
              className={options.variant === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {isProcessing ? "Processing..." : (options.confirmText || "Confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  };

  return {
    confirm,
    ConfirmationDialog,
  };
}
