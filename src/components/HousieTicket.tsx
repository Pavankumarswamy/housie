import { Card, CardContent } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { convertFlatToGrid } from "@/utils/ticketGenerator";

interface HousieTicketProps {
  numbers: number[];
  gameId?: string;
  ticketId?: string;
  className?: string;
  drawnNumbers?: number[];
  onWinDetected?: (winType: string) => void;
}

const HousieTicket = ({ 
  numbers, 
  gameId, 
  ticketId, 
  className = "", 
  drawnNumbers = [],
  onWinDetected 
}: HousieTicketProps) => {
  const [struckNumbers, setStruckNumbers] = useState<Set<number>>(new Set());
  
  // Safely handle different data formats and ensure exactly 15 numbers
  let ticketNumbers: number[];
  let ticketGrid: (number | 0)[][];
  
  try {
    if (!numbers) {
      ticketNumbers = [];
    } else if (Array.isArray(numbers)) {
      // If it's a flat array, use it directly
      if (typeof numbers[0] === 'number') {
        ticketNumbers = numbers;
      } else {
        // If it's a 2D array, flatten it
        ticketNumbers = numbers.flat();
      }
    } else {
      // If it's a string or other format, try to parse
      const parsed = JSON.parse(String(numbers));
      if (Array.isArray(parsed)) {
        ticketNumbers = Array.isArray(parsed[0]) ? parsed.flat() : parsed;
      } else {
        ticketNumbers = [];
      }
    }
  } catch (error) {
    console.error('Error parsing ticket numbers:', error);
    ticketNumbers = [];
  }
  
  // Ensure we have exactly 15 numbers
  if (ticketNumbers.length !== 15) {
    console.warn(`Ticket should have exactly 15 numbers, got ${ticketNumbers.length}`);
    // Pad with zeros or truncate to 15
    if (ticketNumbers.length < 15) {
      ticketNumbers = [...ticketNumbers, ...Array(15 - ticketNumbers.length).fill(0)];
    } else {
      ticketNumbers = ticketNumbers.slice(0, 15);
    }
  }

  // Convert flat array to proper 3x9 Housie grid format
  try {
    if (ticketNumbers.length === 15 && ticketNumbers.some(n => n > 0)) {
      // Check if this looks like a proper Housie ticket first
      const validNumbers = ticketNumbers.filter(n => n > 0);
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
        // This ticket has column overflow, use convertFlatToGrid which will regenerate it
        console.log('Ticket has column overflow, regenerating proper format');
        ticketGrid = convertFlatToGrid(validNumbers);
      } else {
        // Try to arrange in 3x9 format manually
        const grid: (number | 0)[][] = Array(3).fill(null).map(() => Array(9).fill(0));
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
        
        // Sort numbers within each column
        for (const col in numbersbyColumn) {
          numbersbyColumn[col].sort((a, b) => a - b);
        }
        
        // Place numbers ensuring 5 per row
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
        
        ticketGrid = grid;
      }
    } else {
      // Fallback: create a simple 3x5 grid for display
      ticketGrid = [
        Array(9).fill(0),
        Array(9).fill(0),
        Array(9).fill(0)
      ];
      
      // Place numbers in first 5 columns
      for (let i = 0; i < Math.min(15, ticketNumbers.length); i++) {
        const row = Math.floor(i / 5);
        const col = i % 5;
        if (row < 3 && ticketNumbers[i] > 0) {
          ticketGrid[row][col] = ticketNumbers[i];
        }
      }
    }
  } catch (error) {
    console.error('Error converting to grid:', error);
    // Fallback: create a simple 3x5 layout in 9-column format
    ticketGrid = [
      Array(9).fill(0),
      Array(9).fill(0),
      Array(9).fill(0)
    ];
    
    // Place numbers in first 5 columns
    for (let i = 0; i < Math.min(15, ticketNumbers.length); i++) {
      const row = Math.floor(i / 5);
      const col = i % 5;
      if (row < 3 && ticketNumbers[i] > 0) {
        ticketGrid[row][col] = ticketNumbers[i];
      }
    }
  }

  // Update struck numbers when drawn numbers change
  useEffect(() => {
    const newStruckNumbers = new Set<number>();
    ticketNumbers.forEach(num => {
      if (num > 0 && drawnNumbers.includes(num)) {
        newStruckNumbers.add(num);
      }
    });
    setStruckNumbers(newStruckNumbers);
    
    // Check for wins
    checkForWins(newStruckNumbers);
  }, [drawnNumbers, ticketNumbers]);

  const checkForWins = (struck: Set<number>) => {
    if (!onWinDetected) return;
    
    const struckCount = struck.size;
    const validNumbers = ticketNumbers.filter(num => num > 0);
    
    // Early Five - first 5 numbers struck
    if (struckCount === 5 && !struck.has(-1)) { // -1 flag to prevent multiple early five calls
      onWinDetected('early_five');
      struck.add(-1); // Mark that early five has been detected
    }
    
    // Check for line wins (any complete row)
    // For 3x9 grid, each row should have exactly 5 numbers
    ticketGrid.forEach((row, rowIndex) => {
      const rowNumbers = row.filter(num => num > 0);
      const struckInRow = rowNumbers.filter(num => struck.has(num));
      
      // A line is complete when all numbers in that row are struck
      if (rowNumbers.length > 0 && struckInRow.length === rowNumbers.length) {
        const lineTypes = ['top_line', 'middle_line', 'bottom_line'];
        onWinDetected(lineTypes[rowIndex]);
      }
    });
    
    // Full House - all valid numbers struck
    if (validNumbers.length === 15 && validNumbers.every(num => struck.has(num))) {
      onWinDetected('full_house');
    }
  };

  const isNumberStruck = (num: number) => {
    return num > 0 && struckNumbers.has(num);
  };

  return (
    <Card className={`w-full max-w-md mx-auto bg-gradient-to-br from-blue-50 to-indigo-100 border-2 border-blue-200 ${className}`}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="text-center mb-4">
          <h3 className="text-lg font-bold text-blue-800">TAMBOLA TICKET</h3>
          {gameId && (
            <p className="text-sm text-blue-600">Game #{gameId.slice(-6)}</p>
          )}
          {ticketId && (
            <p className="text-xs text-gray-500">Ticket #{ticketId.slice(-8)}</p>
          )}
          <p className="text-xs text-blue-600 font-medium">15 Numbers</p>
        </div>

        {/* Ticket Grid - 3 rows × 9 columns (Housie format) */}
        <div className="space-y-1 mb-4">
          {/* Column headers showing ranges */}
          <div className="grid grid-cols-9 gap-1 mb-2">
            {['1-9', '10-19', '20-29', '30-39', '40-49', '50-59', '60-69', '70-79', '80-90'].map((range, index) => (
              <div key={index} className="text-xs text-center text-gray-500 font-medium">
                {range}
              </div>
            ))}
          </div>
          
          {ticketGrid.map((row, rowIndex) => (
            <div key={rowIndex} className="grid grid-cols-9 gap-1">
              {row.map((num, colIndex) => (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className={`
                    w-8 h-8 flex items-center justify-center text-xs font-bold
                    border-2 rounded transition-all duration-300
                    ${num === 0 
                      ? 'bg-gray-100 text-gray-300 border-gray-200' 
                      : isNumberStruck(num)
                        ? 'bg-green-500 text-white border-green-600 shadow-lg transform scale-105 line-through'
                        : 'bg-white text-blue-800 border-blue-300 hover:bg-blue-50 hover:border-blue-400'
                    }
                  `}
                >
                  {num > 0 ? num : ''}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="flex justify-between items-center text-xs text-gray-600 mb-2">
          <span>Numbers: {ticketNumbers.filter(n => n > 0).length}/15</span>
          <span>Struck: {struckNumbers.size}</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
          <div 
            className="bg-green-500 h-2 rounded-full transition-all duration-500"
            style={{ 
              width: `${(struckNumbers.size / ticketNumbers.filter(n => n > 0).length) * 100}%` 
            }}
          ></div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <div className="text-xs text-gray-500 space-y-1">
            <p>Good Luck!</p>
            <p className="text-blue-600 font-semibold">Play Responsibly</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default HousieTicket;