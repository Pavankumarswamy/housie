import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  analyzeExistingTickets, 
  fixInvalidTickets, 
  runTicketMigration 
} from "@/utils/fixExistingTickets";
import {
  Shield,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  XCircle,
  Search,
  Wrench,
  Database,
  Info
} from "lucide-react";

interface AnalysisResult {
  totalTickets: number;
  validTickets: number;
  invalidTickets: { ticket: any; issues: string[] }[];
}

interface FixResult {
  processed: number;
  fixed: number;
  failed: number;
  errors: string[];
}

const AdminTicketMigration = () => {
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [fixResult, setFixResult] = useState<FixResult | null>(null);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalysisResult(null);
    setFixResult(null);
    
    try {
      toast({
        title: "Analyzing Tickets",
        description: "Checking all existing tickets for compliance with Housie rules...",
      });

      const result = await analyzeExistingTickets();
      setAnalysisResult(result);
      
      if (result.invalidTickets.length === 0) {
        toast({
          title: "Analysis Complete",
          description: "✅ All tickets are valid! No migration needed.",
        });
      } else {
        toast({
          title: "Analysis Complete",
          description: `Found ${result.invalidTickets.length} invalid tickets that need fixing.`,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze tickets",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFix = async (dryRun: boolean = true) => {
    setFixing(true);
    setFixResult(null);
    setProgress(0);
    
    try {
      const actionText = dryRun ? "Simulating" : "Fixing";
      toast({
        title: `${actionText} Ticket Fix`,
        description: `${actionText} invalid tickets with proper Housie format...`,
      });

      // Simulate progress during fix operation
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const result = await fixInvalidTickets(dryRun);
      
      clearInterval(progressInterval);
      setProgress(100);
      setFixResult(result);
      
      if (dryRun) {
        toast({
          title: "Dry Run Complete",
          description: `Would fix ${result.processed} tickets. Run actual fix to apply changes.`,
        });
      } else {
        toast({
          title: "Fix Complete",
          description: `✅ Successfully fixed ${result.fixed} out of ${result.processed} tickets.`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Fix Failed",
        description: error.message || "Failed to fix tickets",
        variant: "destructive",
      });
    } finally {
      setFixing(false);
      setProgress(0);
    }
  };

  const handleRunFullMigration = async () => {
    setLoading(true);
    
    try {
      toast({
        title: "Running Full Migration",
        description: "Analyzing and fixing all invalid tickets...",
      });

      await runTicketMigration({ dryRun: false, analyzeOnly: false });
      
      // Refresh analysis after migration
      const result = await analyzeExistingTickets();
      setAnalysisResult(result);
      
      toast({
        title: "Migration Complete",
        description: "✅ All tickets have been migrated to proper Housie format!",
      });
    } catch (error: any) {
      toast({
        title: "Migration Failed",
        description: error.message || "Failed to run migration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-500" />
          Ticket Migration & Validation
        </CardTitle>
        <CardDescription>
          Check and fix existing tickets to ensure they follow proper Housie rules (3×9 grid, 5 numbers per row)
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            onClick={handleAnalyze}
            disabled={analyzing}
            variant="outline"
            className="flex items-center gap-2"
          >
            {analyzing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            {analyzing ? "Analyzing..." : "Analyze Tickets"}
          </Button>
          
          <Button
            onClick={() => handleFix(true)}
            disabled={fixing || !analysisResult}
            variant="outline"
            className="flex items-center gap-2"
          >
            {fixing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Info className="w-4 h-4" />
            )}
            Dry Run Fix
          </Button>
          
          <Button
            onClick={() => handleFix(false)}
            disabled={fixing || !analysisResult || analysisResult.invalidTickets.length === 0}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600"
          >
            {fixing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Wrench className="w-4 h-4" />
            )}
            Fix Invalid Tickets
          </Button>
        </div>

        {/* Progress Bar */}
        {fixing && progress > 0 && (
          <div className="space-y-2">
            <Progress value={progress} />
            <p className="text-sm text-muted-foreground text-center">
              {progress < 100 ? `Processing... ${progress}%` : "Completing..."}
            </p>
          </div>
        )}

        {/* Analysis Results */}
        {analysisResult && (
          <Alert>
            <Database className="h-4 w-4" />
            <AlertTitle>Analysis Results</AlertTitle>
            <AlertDescription className="mt-2">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    Total: {analysisResult.totalTickets}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <Badge className="bg-green-100 text-green-800">
                    Valid: {analysisResult.validTickets}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <Badge className="bg-red-100 text-red-800">
                    Invalid: {analysisResult.invalidTickets.length}
                  </Badge>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Invalid Tickets Details */}
        {analysisResult && analysisResult.invalidTickets.length > 0 && (
          <Card className="border-red-200 bg-red-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                Invalid Tickets Found
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-40">
                <div className="space-y-2">
                  {analysisResult.invalidTickets.slice(0, 10).map(({ ticket, issues }, index) => (
                    <div key={ticket.id} className="p-2 bg-white rounded border text-xs">
                      <div className="flex justify-between items-start">
                        <span className="font-medium">
                          Ticket #{ticket.id.slice(-8)}
                        </span>
                        <Badge variant="destructive" className="text-xs">
                          {issues.length} issue{issues.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mt-1">
                        Issues: {issues.join(', ')}
                      </p>
                    </div>
                  ))}
                  {analysisResult.invalidTickets.length > 10 && (
                    <p className="text-xs text-muted-foreground text-center">
                      ... and {analysisResult.invalidTickets.length - 10} more
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Fix Results */}
        {fixResult && (
          <Alert className={fixResult.failed === 0 ? "" : "border-orange-200 bg-orange-50/50"}>
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Fix Results</AlertTitle>
            <AlertDescription className="mt-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium">Processed:</span> {fixResult.processed}
                </div>
                <div>
                  <span className="font-medium">Fixed:</span> {fixResult.fixed}
                </div>
                <div>
                  <span className="font-medium">Failed:</span> {fixResult.failed}
                </div>
                <div>
                  <span className="font-medium">Success Rate:</span>{" "}
                  {fixResult.processed > 0 
                    ? Math.round((fixResult.fixed / fixResult.processed) * 100)
                    : 0}%
                </div>
              </div>
              {fixResult.errors.length > 0 && (
                <div className="mt-2 p-2 bg-red-100 rounded text-xs">
                  <p className="font-medium text-red-800">Errors:</p>
                  <ul className="list-disc list-inside text-red-700">
                    {fixResult.errors.slice(0, 3).map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Quick Action */}
        {analysisResult && analysisResult.invalidTickets.length > 0 && (
          <Alert className="border-blue-200 bg-blue-50/50">
            <Info className="h-4 w-4" />
            <AlertTitle>Recommended Action</AlertTitle>
            <AlertDescription className="mt-2">
              <p className="text-sm mb-3">
                Found {analysisResult.invalidTickets.length} tickets that don't follow proper Housie rules.
                These tickets will be regenerated with the correct 3×9 grid format while preserving game and user associations.
              </p>
              <Button
                onClick={handleRunFullMigration}
                disabled={loading}
                className="bg-blue-500 hover:bg-blue-600"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Database className="w-4 h-4 mr-2" />
                )}
                Run Full Migration
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Information */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Migration Information</AlertTitle>
          <AlertDescription className="text-sm space-y-2">
            <p>
              <strong>What this does:</strong> Validates all existing tickets against proper Housie rules 
              and regenerates invalid tickets with correct 3×9 grid format.
            </p>
            <p>
              <strong>Rules checked:</strong> 15 unique numbers, 3 rows × 9 columns, exactly 5 numbers per row, 
              max 3 numbers per column, correct column ranges (1-9, 10-19, etc.)
            </p>
            <p>
              <strong>Safe operation:</strong> Game and user associations are preserved. Only the ticket numbers are regenerated.
            </p>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default AdminTicketMigration;
