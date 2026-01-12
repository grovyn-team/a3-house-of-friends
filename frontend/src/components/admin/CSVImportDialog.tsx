import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

interface CSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
  importFunction: (file: File) => Promise<any>;
}

export function CSVImportDialog({ open, onOpenChange, onImportComplete, importFunction }: CSVImportDialogProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'text/csv' || droppedFile.name.endsWith('.csv')) {
      setFile(droppedFile);
      setImportResult(null);
    } else {
      toast({
        title: "Invalid File",
        description: "Please upload a CSV file.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setImportResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    try {
      setIsImporting(true);
      const result = await importFunction(file);
      setImportResult(result);
      
      if (result.results.success > 0) {
        toast({
          title: "Import Successful",
          description: `${result.results.success} items imported successfully.`,
        });
        setTimeout(() => {
          onImportComplete();
          handleClose();
        }, 2000);
      } else {
        toast({
          title: "Import Failed",
          description: result.message || "No items were imported.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Import Error",
        description: error.message || "Failed to import CSV file.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setImportResult(null);
    setIsDragging(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Inventory Items from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file to bulk import inventory items. Existing items with matching SKU will be updated.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-all
              ${isDragging ? 'border-primary bg-primary/5' : 'border-border'}
              ${file ? 'border-success bg-success/5' : ''}
            `}
          >
            <AnimatePresence mode="wait">
              {file ? (
                <motion.div
                  key="file-selected"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="space-y-2"
                >
                  <CheckCircle className="h-12 w-12 text-success mx-auto" />
                  <div className="font-medium text-foreground">{file.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(2)} KB
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFile(null)}
                    className="mt-2"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Remove File
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="no-file"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <Upload className="h-12 w-12 text-muted-foreground mx-auto" />
                  <div>
                    <div className="font-medium text-foreground mb-1">
                      Drag and drop your CSV file here
                    </div>
                    <div className="text-sm text-muted-foreground">
                      or click the button below to browse
                    </div>
                  </div>
                  <label>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Button asChild variant="outline">
                      <span>
                        <FileText className="h-4 w-4 mr-2" />
                        Select CSV File
                      </span>
                    </Button>
                  </label>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {importResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-lg bg-card border border-border"
            >
              <div className="flex items-start gap-3">
                {importResult.results.success > 0 ? (
                  <CheckCircle className="h-5 w-5 text-success mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-warning mt-0.5" />
                )}
                <div className="flex-1 space-y-2">
                  <div className="font-medium text-foreground">
                    {importResult.message}
                  </div>
                  <div className="text-sm space-y-1">
                    <div className="text-success">
                      ✓ {importResult.results.success} items imported successfully
                    </div>
                    {importResult.results.failed > 0 && (
                      <div className="text-destructive">
                        ✗ {importResult.results.failed} items failed
                      </div>
                    )}
                  </div>
                  {importResult.results.errors.length > 0 && (
                    <details className="mt-2">
                      <summary className="text-sm text-muted-foreground cursor-pointer">
                        View errors ({importResult.results.errors.length})
                      </summary>
                      <div className="mt-2 p-2 bg-muted rounded text-xs max-h-32 overflow-y-auto">
                        {importResult.results.errors.map((error: string, idx: number) => (
                          <div key={idx} className="text-destructive">{error}</div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose} disabled={isImporting}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!file || isImporting}
            >
              {isImporting ? (
                <>
                  <Upload className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import Items
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
