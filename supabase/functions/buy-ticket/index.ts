import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface HousieTicketGrid {
  grid: (number | 0)[][]; // 3x9 grid where 0 represents empty cell
  flatNumbers: number[];  // Flat array of the 15 numbers for storage
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { gameId, userId, ticketPrice } = await req.json()

    // Generate proper Housie ticket with 3x9 grid, 5 numbers per row
    const ticketData = generateHousieTicket()
    const numbers = ticketData.flatNumbers

    // Start transaction
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('wallet')
      .eq('id', userId)
      .single()

    if (userError || user.wallet < ticketPrice) {
      throw new Error('Insufficient wallet balance')
    }

    // Check game availability
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single()

    if (gameError || game.total_tickets >= game.max_tickets) {
      throw new Error('Game full or not available')
    }

    // Create ticket
    const { error: ticketError } = await supabase
      .from('tickets')
      .insert({
        game_id: gameId,
        user_id: userId,
        numbers: numbers,
        claimed_prizes: {}
      })

    if (ticketError) throw ticketError

    // Update user wallet using safe function
    const { data: walletResult, error: walletError } = await supabase
      .rpc('decrement_wallet', {
        user_id: userId,
        amount_to_subtract: ticketPrice
      })

    if (walletError || !walletResult) {
      throw new Error('Failed to deduct wallet balance')
    }

    // Update game stats
    const newTotal = game.total_tickets + 1
    const newCollection = game.total_collection + ticketPrice
    const adminCommission = newCollection * 0.20
    const prizePool = newCollection - adminCommission

    const { error: gameUpdateError } = await supabase
      .from('games')
      .update({
        total_tickets: newTotal,
        total_collection: newCollection,
        admin_commission: adminCommission,
        prize_pool: prizePool
      })
      .eq('id', gameId)

    if (gameUpdateError) throw gameUpdateError

    // Add transaction
    await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'debit',
        amount: ticketPrice,
        reason: 'Ticket purchase',
        game_id: gameId
      })

    return new Response(JSON.stringify({ success: true, numbers }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function generateHousieTicket(): HousieTicketGrid {
  // Define column ranges
  const columnRanges = [
    [1, 9],     // Column 0: 1-9
    [10, 19],   // Column 1: 10-19
    [20, 29],   // Column 2: 20-29
    [30, 39],   // Column 3: 30-39
    [40, 49],   // Column 4: 40-49
    [50, 59],   // Column 5: 50-59
    [60, 69],   // Column 6: 60-69
    [70, 79],   // Column 7: 70-79
    [80, 90]    // Column 8: 80-90
  ];

  // Initialize 3x9 grid with zeros
  const grid: (number | 0)[][] = Array(3).fill(null).map(() => Array(9).fill(0));
  
  // Track how many numbers are placed in each column (max 3 per column)
  const columnCounts = Array(9).fill(0);
  
  // Generate numbers for each column
  const columnNumbers: number[][] = Array(9).fill(null).map(() => []);
  
  // For each column, decide how many numbers to place (1, 2, or 3)
  // We need to ensure total numbers across all columns = 15
  let totalNumbers = 0;
  const targetNumbers = 15;
  
  // Strategy: Use 5-6 columns with 2-3 numbers each
  // This ensures good distribution and follows the constraint
  while (totalNumbers < targetNumbers) {
    for (let col = 0; col < 9 && totalNumbers < targetNumbers; col++) {
      if (columnCounts[col] < 3) {
        const canAdd = Math.min(3 - columnCounts[col], targetNumbers - totalNumbers);
        const numbersToAdd = Math.min(canAdd, Math.floor(Math.random() * 2) + 1); // 1 or 2 numbers
        
        columnCounts[col] += numbersToAdd;
        totalNumbers += numbersToAdd;
        
        // Generate unique numbers for this column
        const [min, max] = columnRanges[col];
        const availableNumbers = [];
        for (let n = min; n <= max; n++) {
          if (!columnNumbers[col].includes(n)) {
            availableNumbers.push(n);
          }
        }
        
        if (availableNumbers.length >= numbersToAdd) {
          // Shuffle and take required numbers
          shuffleArray(availableNumbers);
          const selectedNumbers = availableNumbers.slice(0, numbersToAdd).sort((a, b) => a - b);
          columnNumbers[col].push(...selectedNumbers);
        } else {
          // Take all available numbers if less than required
          columnNumbers[col].push(...availableNumbers.sort((a, b) => a - b));
          totalNumbers -= numbersToAdd - availableNumbers.length; // Adjust total count
          columnCounts[col] -= numbersToAdd - availableNumbers.length;
        }
      }
    }
  }
  
  // If we still don't have exactly 15 numbers, adjust
  while (totalNumbers < targetNumbers) {
    // Find a column that can take more numbers
    for (let col = 0; col < 9; col++) {
      if (columnCounts[col] < 3 && totalNumbers < targetNumbers) {
        const [min, max] = columnRanges[col];
        const availableNumbers = [];
        for (let n = min; n <= max; n++) {
          if (!columnNumbers[col].includes(n)) {
            availableNumbers.push(n);
          }
        }
        
        if (availableNumbers.length > 0) {
          const randomNum = availableNumbers[Math.floor(Math.random() * availableNumbers.length)];
          columnNumbers[col].push(randomNum);
          columnNumbers[col].sort((a, b) => a - b);
          columnCounts[col]++;
          totalNumbers++;
          break;
        }
      }
    }
  }
  
  // Remove excess numbers if we have more than 15
  while (totalNumbers > targetNumbers) {
    for (let col = 0; col < 9; col++) {
      if (columnNumbers[col].length > 0 && totalNumbers > targetNumbers) {
        columnNumbers[col].pop();
        columnCounts[col]--;
        totalNumbers--;
        break;
      }
    }
  }
  
  // Now place numbers in the grid ensuring 5 numbers per row
  const rowCounts = [0, 0, 0];
  
  // Collect all numbers with their column info
  const allNumbers: { num: number; col: number }[] = [];
  for (let col = 0; col < 9; col++) {
    for (const num of columnNumbers[col]) {
      allNumbers.push({ num, col });
    }
  }
  
  // Sort by column to maintain column-wise distribution
  allNumbers.sort((a, b) => a.col - b.col);
  
  // Place numbers ensuring 5 per row constraint
  for (const { num, col } of allNumbers) {
    // Find the row with least numbers that can accommodate this column
    let bestRow = -1;
    for (let row = 0; row < 3; row++) {
      if (rowCounts[row] < 5 && grid[row][col] === 0) {
        if (bestRow === -1 || rowCounts[row] < rowCounts[bestRow]) {
          bestRow = row;
        }
      }
    }
    
    if (bestRow !== -1) {
      grid[bestRow][col] = num;
      rowCounts[bestRow]++;
    }
  }
  
  // Verify the ticket meets all requirements
  validateTicket(grid);
  
  // Create flat array of numbers (non-zero values only)
  const flatNumbers: number[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 9; col++) {
      if (grid[row][col] !== 0) {
        flatNumbers.push(grid[row][col] as number);
      }
    }
  }
  
  console.log('Generated proper Housie ticket:', { grid, flatNumbers: flatNumbers.sort((a, b) => a - b) });
  return { grid, flatNumbers: flatNumbers.sort((a, b) => a - b) };
}

function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function validateTicket(grid: (number | 0)[][]): void {
  // Check row counts (exactly 5 numbers per row)
  for (let row = 0; row < 3; row++) {
    const numbersInRow = grid[row].filter(cell => cell !== 0).length;
    if (numbersInRow !== 5) {
      console.error(`Row ${row} has ${numbersInRow} numbers, expected 5`);
      throw new Error(`Invalid ticket: Row ${row} has ${numbersInRow} numbers instead of 5`);
    }
  }
  
  // Check column constraints (max 3 numbers per column)
  for (let col = 0; col < 9; col++) {
    const numbersInCol = grid.filter(row => row[col] !== 0).length;
    if (numbersInCol > 3) {
      console.error(`Column ${col} has ${numbersInCol} numbers, maximum allowed is 3`);
      throw new Error(`Invalid ticket: Column ${col} has ${numbersInCol} numbers, maximum allowed is 3`);
    }
  }
  
  // Check total numbers (exactly 15)
  const totalNumbers = grid.flat().filter(cell => cell !== 0).length;
  if (totalNumbers !== 15) {
    console.error(`Total numbers: ${totalNumbers}, expected 15`);
    throw new Error(`Invalid ticket: Has ${totalNumbers} numbers instead of 15`);
  }
  
  // Check number ranges for each column
  const columnRanges = [
    [1, 9], [10, 19], [20, 29], [30, 39], [40, 49],
    [50, 59], [60, 69], [70, 79], [80, 90]
  ];
  
  for (let col = 0; col < 9; col++) {
    const [min, max] = columnRanges[col];
    for (let row = 0; row < 3; row++) {
      const num = grid[row][col];
      if (num !== 0 && (num < min || num > max)) {
        console.error(`Number ${num} in column ${col} is outside range ${min}-${max}`);
        throw new Error(`Invalid ticket: Number ${num} in column ${col} is outside allowed range ${min}-${max}`);
      }
    }
  }
  
  // Check for duplicate numbers
  const allNumbers = grid.flat().filter(cell => cell !== 0);
  const uniqueNumbers = new Set(allNumbers);
  if (allNumbers.length !== uniqueNumbers.size) {
    console.error('Duplicate numbers found in ticket');
    throw new Error('Invalid ticket: Contains duplicate numbers');
  }
  
  console.log('Ticket validation passed');
}
