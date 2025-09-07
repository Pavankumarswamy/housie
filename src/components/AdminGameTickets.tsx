import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import HousieTicket from "./HousieTicket";
import { convertFlatToGrid } from "@/utils/ticketGenerator";
import { 
  Eye, 
  Users, 
  Ticket,
  Trophy,
  CheckCircle,
  XCircle,
  AlertCircle,
  Shield,
  AlertTriangle
} from "lucide-react";

interface AdminGameTicketsProps {
  gameId: string;
  gameStatus: string;
  drawnNumbers?: number[];
}

interface TicketData {
  id: string;
  user_id: string;
  numbers: number[];
  created_at: string;
  claimed_prizes: any;
  users: {
    name: string;
    pin: string;
  };
}

const AdminGameTickets = ({ gameId, gameStatus, drawnNumbers = [] }: AdminGameTicketsProps) => {
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const loadTickets = async () => {
    if (!gameId) {
      console.warn('No gameId provided to loadTickets');
      return;
    }
    
    console.log('Loading tickets for game:', gameId);
    setLoading(true);
    
    try {
      // First, try with the foreign key relationship
      let { data, error } = await supabase
        .from("tickets")
        .select(`
          *,
          users!tickets_user_id_fkey(name, pin)
        `)
        .eq("game_id", gameId)
        .order("created_at", { ascending: true });

      // If that fails, try with a simpler approach
      if (error) {
        console.warn('Foreign key query failed, trying simple query:', error);
        const simpleQuery = await supabase
          .from("tickets")
          .select('*')
          .eq("game_id", gameId)
          .order("created_at", { ascending: true });
        
        if (simpleQuery.error) {
          console.error("Simple query also failed:", simpleQuery.error);
          throw simpleQuery.error;
        }
        
        // Get user data separately
        data = simpleQuery.data;
        if (data && data.length > 0) {
          const userIds = [...new Set(data.map(ticket => ticket.user_id))];
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id, name, pin')
            .in('id', userIds);
            
          if (userError) {
            console.error('Error loading user data:', userError);
          } else {
            // Combine ticket and user data
            data = data.map(ticket => {
              const user = userData?.find(u => u.id === ticket.user_id);
              return {
                ...ticket,
                users: user ? { name: user.name, pin: user.pin } : { name: 'Unknown', pin: 'N/A' }
              };
            });
          }
        }
      }

      console.log(`Successfully loaded ${data?.length || 0} tickets for game ${gameId}:`, data);
      setTickets(data || []);
      
      if ((data?.length || 0) === 0) {
        toast({
          title: "No Tickets Found",
          description: "No tickets have been purchased for this game yet.",
        });
      }
      
    } catch (error: any) {
      console.error('Error loading tickets:', error);
      toast({
        title: "Error Loading Tickets",
        description: error.message || "Failed to load game tickets. Please try again.",
        variant: "destructive",
      });
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadTickets();
    }
  }, [isOpen, gameId]);

  const validateTicketFormat = (ticketNumbers: number[]) => {
    const issues: string[] = [];
    
    try {
      const validNumbers = ticketNumbers.filter(n => typeof n === 'number' && n > 0);
      
      // Check if exactly 15 numbers
      if (validNumbers.length !== 15) {
        issues.push(`Has ${validNumbers.length} numbers instead of 15`);
      }

      // Check for duplicates
      const uniqueNumbers = new Set(validNumbers);
      if (uniqueNumbers.size !== validNumbers.length) {
        issues.push('Contains duplicate numbers');
      }

      // Check number ranges
      for (const num of validNumbers) {
        if (num < 1 || num > 90) {
          issues.push(`Number ${num} is outside valid range 1-90`);
        }
      }

      // Check column distribution
      const columnRanges = [
        [1, 9], [10, 19], [20, 29], [30, 39], [40, 49],
        [50, 59], [60, 69], [70, 79], [80, 90]
      ];

      const columnCounts = Array(9).fill(0);
      for (const num of validNumbers) {
        for (let col = 0; col < columnRanges.length; col++) {
          const [min, max] = columnRanges[col];
          if (num >= min && num <= max) {
            columnCounts[col]++;
            break;
          }
        }
      }

      // Check if any column has more than 3 numbers
      let hasColumnIssues = false;
      for (let col = 0; col < columnCounts.length; col++) {
        if (columnCounts[col] > 3) {
          hasColumnIssues = true;
          issues.push(`Column ${col + 1} has ${columnCounts[col]} numbers (max 3 allowed)`);
        }
      }
      
      if (hasColumnIssues) {
        issues.push('Not proper Housie format');
      }

      return { 
        isValid: issues.length === 0, 
        issues, 
        columnCounts,
        isProperFormat: !hasColumnIssues && issues.length === 0
      };
    } catch (error) {
      return { 
        isValid: false, 
        issues: [`Error validating: ${error}`], 
        columnCounts: [],
        isProperFormat: false
      };
    }
  };

  const testConnection = async () => {
    console.log('Testing Supabase connection...');
    try {
      // Test basic connection
      const { data, error } = await supabase
        .from('tickets')
        .select('count')
        .limit(1);
      
      if (error) {
        console.error('Connection test failed:', error);
        toast({
          title: "Connection Test Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        console.log('Connection test successful');
        toast({
          title: "Connection Test Successful",
          description: "Database connection is working",
        });
      }
    } catch (error: any) {
      console.error('Connection test error:', error);
      toast({
        title: "Connection Test Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const analyzeTicket = (ticketNumbers: number[]) => {
    if (!Array.isArray(drawnNumbers) || drawnNumbers.length === 0) {
      return { 
        struckNumbers: [], 
        completedLines: [], 
        isEarlyFive: false, 
        isFullHouse: false,
        struckCount: 0 
      };
    }

    const validNumbers = ticketNumbers.filter(n => n > 0);
    const struckNumbers = validNumbers.filter(num => drawnNumbers.includes(num));
    const struckCount = struckNumbers.length;

    // Check lines using proper 3x9 grid analysis
    const completedLines: string[] = [];
    let grid: (number | 0)[][];
    
    try {
      // Try to convert to proper 3x9 grid format
      if (validNumbers.length === 15) {
        // Check for column overflow first
        const columnRanges = [
          [1, 9], [10, 19], [20, 29], [30, 39], [40, 49],
          [50, 59], [60, 69], [70, 79], [80, 90]
        ];
        
        const columnCounts = Array(9).fill(0);
        let hasColumnOverflow = false;
        
        for (const num of validNumbers) {
          for (let col = 0; col < columnRanges.length; col++) {
            const [min, max] = columnRanges[col];
            if (num >= min && num <= max) {
              columnCounts[col]++;
              if (columnCounts[col] > 3) {
                hasColumnOverflow = true;
              }
              break;
            }
          }
        }
        
        if (hasColumnOverflow) {
          // Generate proper grid for analysis
          grid = convertFlatToGrid(validNumbers);
        } else {
          // Create proper 3x9 layout manually
          grid = Array(3).fill(null).map(() => Array(9).fill(0));
          const numbersbyColumn: { [col: number]: number[] } = {};
          
          // Group numbers by column
          for (const num of validNumbers) {
            for (let i = 0; i < columnRanges.length; i++) {
              const [min, max] = columnRanges[i];
              if (num >= min && num <= max) {
                if (!numbersbyColumn[i]) numbersbyColumn[i] = [];
                numbersbyColumn[i].push(num);
                break;
              }
            }
          }
          
          // Sort and place numbers
          for (const col in numbersbyColumn) {
            numbersbyColumn[col].sort((a, b) => a - b);
          }
          
          const rowCounts = [0, 0, 0];
          for (const colStr in numbersbyColumn) {
            const col = parseInt(colStr);
            const numbers = numbersbyColumn[col];
            
            for (const num of numbers) {
              let bestRow = 0;
              for (let row = 1; row < 3; row++) {
                if (rowCounts[row] < rowCounts[bestRow] && rowCounts[row] < 5) {
                  bestRow = row;
                }
              }
              
              if (rowCounts[bestRow] < 5) {
                grid[bestRow][col] = num;
                rowCounts[bestRow]++;
              }
            }
          }
        }
      } else {
        // Fallback to 3x5 for incomplete tickets
        grid = [
          Array(9).fill(0),
          Array(9).fill(0),
          Array(9).fill(0)
        ];
        
        // Place numbers in first 5 columns
        for (let i = 0; i < Math.min(15, ticketNumbers.length); i++) {
          const row = Math.floor(i / 5);
          const col = i % 5;
          if (row < 3 && ticketNumbers[i] > 0) {
            grid[row][col] = ticketNumbers[i];
          }
        }
      }
    } catch (error) {
      // Fallback to 3x5 grid analysis in 9-column format
      grid = [
        Array(9).fill(0),
        Array(9).fill(0),
        Array(9).fill(0)
      ];
      
      // Place numbers in first 5 columns
      for (let i = 0; i < Math.min(15, ticketNumbers.length); i++) {
        const row = Math.floor(i / 5);
        const col = i % 5;
        if (row < 3 && ticketNumbers[i] > 0) {
          grid[row][col] = ticketNumbers[i];
        }
      }
    }

    // Check each row for complete lines
    grid.forEach((row, index) => {
      const rowNumbers = row.filter(n => n > 0);
      const struckInRow = rowNumbers.filter(num => struckNumbers.includes(num));
      
      // A line is complete when all numbers in that row are struck
      if (rowNumbers.length > 0 && struckInRow.length === rowNumbers.length) {
        const lineNames = ['Top Line', 'Middle Line', 'Bottom Line'];
        completedLines.push(lineNames[index]);
      }
    });

    const isEarlyFive = struckCount === 5;
    const isFullHouse = validNumbers.length > 0 && validNumbers.every(num => struckNumbers.includes(num));

    return {
      struckNumbers,
      completedLines,
      isEarlyFive,
      isFullHouse,
      struckCount
    };
  };

  const getWinBadges = (analysis: ReturnType<typeof analyzeTicket>) => {
    const badges = [];
    
    if (analysis.isEarlyFive) {
      badges.push(
        <Badge key="early-five" className="bg-yellow-500 text-yellow-foreground">
          <Trophy className="w-3 h-3 mr-1" />
          Early Five
        </Badge>
      );
    }

    analysis.completedLines.forEach((line, index) => {
      badges.push(
        <Badge key={`line-${index}`} className="bg-blue-500 text-blue-foreground">
          <CheckCircle className="w-3 h-3 mr-1" />
          {line}
        </Badge>
      );
    });

    if (analysis.isFullHouse) {
      badges.push(
        <Badge key="full-house" className="bg-green-500 text-green-foreground">
          <Trophy className="w-3 h-3 mr-1" />
          Full House
        </Badge>
      );
    }

    return badges;
  };


  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye className="w-4 h-4 mr-2" />
          View Tickets
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex justify-between items-start">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Ticket className="w-5 h-5" />
                Game Tickets - #{gameId.slice(-8)}
              </DialogTitle>
              <DialogDescription>
                View all purchased tickets for this game and check winning status
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={testConnection}
                className="text-xs"
              >
                Test DB
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={loadTickets}
                disabled={loading}
                className="text-xs"
              >
                {loading ? "Loading..." : "Refresh"}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <Card className="bg-secondary/20">
            <CardContent className="p-4">
              {(() => {
                const formatStats = tickets.reduce((acc, ticket) => {
                  const validation = validateTicketFormat(ticket.numbers);
                  if (validation.isProperFormat) {
                    acc.valid++;
                  } else {
                    acc.invalid++;
                  }
                  return acc;
                }, { valid: 0, invalid: 0 });
                
                return (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-500" />
                      <span>Total: <strong>{tickets.length}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-green-500" />
                      <span>Valid Format: <strong className="text-green-600">{formatStats.valid}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <span>Invalid Format: <strong className="text-red-600">{formatStats.invalid}</strong></span>
                    </div>
                    {drawnNumbers.length > 0 && (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-purple-500" />
                        <span>Drawn: <strong>{drawnNumbers.length}/90</strong></span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={gameStatus === 'running' ? 'border-green-500' : gameStatus === 'waiting' ? 'border-yellow-500' : 'border-gray-500'}>
                        {gameStatus}
                      </Badge>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={loadTickets}
                        disabled={loading}
                        className="ml-2"
                      >
                        {loading ? "Loading..." : "Refresh"}
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Tickets Grid */}
          <ScrollArea className="h-[60vh]">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {tickets.map((ticket) => {
                const analysis = analyzeTicket(ticket.numbers);
                const validation = validateTicketFormat(ticket.numbers);
                const winBadges = getWinBadges(analysis);
                
                return (
                  <Card key={ticket.id} className={`relative ${
                    !validation.isProperFormat ? 'border-red-300 bg-red-50/30' : 'border-green-300 bg-green-50/30'
                  }`}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-sm">
                              {ticket.users.name}
                            </CardTitle>
                            {validation.isProperFormat ? (
                              <Badge className="bg-green-100 text-green-800 text-xs">
                                <Shield className="w-3 h-3 mr-1" />
                                Valid Format
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800 text-xs">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Invalid Format
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="text-xs">
                            PIN: {ticket.users.pin} • {new Date(ticket.created_at).toLocaleString()}
                          </CardDescription>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                          <div className="text-xs text-muted-foreground">
                            Ticket #{ticket.id.slice(-6)}
                          </div>
                          {analysis.struckCount > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {analysis.struckCount}/15 struck
                            </Badge>
                          )}
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-6 px-2 text-xs"
                            onClick={() => deleteTicket(ticket.id, ticket.users.name)}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                      
                      {/* Win Badges */}
                      {winBadges.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {winBadges}
                        </div>
                      )}
                    </CardHeader>
                    
                    <CardContent className="p-2">
                      <HousieTicket
                        numbers={ticket.numbers}
                        gameId={gameId}
                        ticketId={ticket.id}
                        drawnNumbers={drawnNumbers}
                        className="scale-75 origin-top-left"
                      />
                      
                      {/* Format Validation Details */}
                      {!validation.isProperFormat && (
                        <div className="mt-2 p-2 bg-red-50 rounded border border-red-200">
                          <p className="text-xs text-red-700 font-medium mb-1">
                            Format Issues:
                          </p>
                          <div className="text-xs text-red-600">
                            {validation.issues.map((issue, index) => (
                              <div key={index} className="flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                {issue}
                              </div>
                            ))}
                          </div>
                          {validation.columnCounts.length > 0 && (
                            <div className="mt-1">
                              <p className="text-xs text-red-600 font-medium">Column Distribution:</p>
                              <div className="flex gap-1 flex-wrap">
                                {validation.columnCounts.map((count, col) => (
                                  <span 
                                    key={col}
                                    className={`text-xs px-1 py-0.5 rounded ${
                                      count > 3 ? 'bg-red-200 text-red-800' : 'bg-gray-200 text-gray-600'
                                    }`}
                                  >
                                    C{col + 1}: {count}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Column Distribution for Valid Tickets */}
                      {validation.isProperFormat && validation.columnCounts.length > 0 && (
                        <div className="mt-2 p-2 bg-green-50 rounded border border-green-200">
                          <p className="text-xs text-green-700 font-medium mb-1">
                            Column Distribution (max 3 per column):
                          </p>
                          <div className="flex gap-1 flex-wrap">
                            {validation.columnCounts.map((count, col) => (
                              <span 
                                key={col}
                                className="text-xs bg-green-200 text-green-800 px-1 py-0.5 rounded"
                              >
                                C{col + 1}: {count}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Struck Numbers Summary */}
                      {analysis.struckNumbers.length > 0 && (
                        <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                          <p className="text-xs text-blue-700 font-medium mb-1">
                            Struck Numbers ({analysis.struckNumbers.length}):
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {analysis.struckNumbers.sort((a, b) => a - b).map((num) => (
                              <span 
                                key={num}
                                className="text-xs bg-blue-200 text-blue-800 px-1 py-0.5 rounded"
                              >
                                {num}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              
              {tickets.length === 0 && !loading && (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  <Ticket className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No tickets purchased for this game yet.</p>
                </div>
              )}
              
              {loading && (
                <div className="col-span-full text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-2 text-sm text-muted-foreground">Loading tickets...</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminGameTickets;
