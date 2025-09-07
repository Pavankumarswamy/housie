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

    const { action, dryRun = true } = await req.json()

    if (action === 'analyze') {
      // Analyze existing tickets
      const { data: tickets, error } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: true })

      if (error) throw error

      const results = {
        totalTickets: tickets?.length || 0,
        invalidTickets: [] as any[],
        validTickets: 0
      }

      if (!tickets || tickets.length === 0) {
        return new Response(JSON.stringify(results), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Validate each ticket
      for (const ticket of tickets) {
        const validation = validateExistingTicket(ticket.numbers)
        
        if (!validation.isValid) {
          results.invalidTickets.push({
            ticket,
            issues: validation.issues
          })
        } else {
          results.validTickets++
        }
      }

      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (action === 'fix') {
      // Get invalid tickets first
      const { data: tickets, error: fetchError } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: true })

      if (fetchError) throw fetchError

      const invalidTickets = []
      for (const ticket of tickets || []) {
        const validation = validateExistingTicket(ticket.numbers)
        if (!validation.isValid) {
          invalidTickets.push({ ticket, issues: validation.issues })
        }
      }

      const results = {
        processed: 0,
        fixed: 0,
        failed: 0,
        errors: [] as string[]
      }

      if (invalidTickets.length === 0) {
        return new Response(JSON.stringify(results), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Fix each invalid ticket
      for (const { ticket } of invalidTickets) {
        results.processed++

        if (!dryRun) {
          try {
            // Generate new valid ticket
            const newTicketData = generateHousieTicket()
            
            // Update the ticket in database
            const { error: updateError } = await supabase
              .from('tickets')
              .update({
                numbers: newTicketData.flatNumbers,
                updated_at: new Date().toISOString()
              })
              .eq('id', ticket.id)

            if (updateError) {
              results.failed++
              results.errors.push(`Failed to update ticket ${ticket.id}: ${updateError.message}`)
            } else {
              results.fixed++
            }
          } catch (error) {
            results.failed++
            results.errors.push(`Error fixing ticket ${ticket.id}: ${error.message}`)
          }
        }
      }

      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    throw new Error('Invalid action')
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

// Validation function
function validateExistingTicket(numbers: any): { isValid: boolean; issues: string[] } {
  const issues: string[] = []
  
  try {
    // Convert to array if needed
    let ticketNumbers: number[]
    if (typeof numbers === 'string') {
      ticketNumbers = JSON.parse(numbers)
    } else if (Array.isArray(numbers)) {
      ticketNumbers = Array.isArray(numbers[0]) ? numbers.flat() : numbers
    } else {
      return { isValid: false, issues: ['Invalid number format'] }
    }

    // Check if exactly 15 numbers
    const validNumbers = ticketNumbers.filter(n => typeof n === 'number' && n > 0)
    if (validNumbers.length !== 15) {
      issues.push(`Has ${validNumbers.length} numbers instead of 15`)
    }

    // Check for duplicates
    const uniqueNumbers = new Set(validNumbers)
    if (uniqueNumbers.size !== validNumbers.length) {
      issues.push('Contains duplicate numbers')
    }

    // Check number ranges (basic validation)
    for (const num of validNumbers) {
      if (num < 1 || num > 90) {
        issues.push(`Number ${num} is outside valid range 1-90`)
      }
    }

    // Check column distribution
    const columnRanges = [
      [1, 9], [10, 19], [20, 29], [30, 39], [40, 49],
      [50, 59], [60, 69], [70, 79], [80, 90]
    ]

    const columnCounts = Array(9).fill(0)
    for (const num of validNumbers) {
      for (let col = 0; col < columnRanges.length; col++) {
        const [min, max] = columnRanges[col]
        if (num >= min && num <= max) {
          columnCounts[col]++
          break
        }
      }
    }

    // For legacy tickets that don't follow proper Housie format,
    // we'll be more lenient and just flag for regeneration
    let hasColumnIssues = false
    for (let col = 0; col < columnCounts.length; col++) {
      if (columnCounts[col] > 3) {
        hasColumnIssues = true
        issues.push(`Column ${col + 1} has ${columnCounts[col]} numbers (max 3 allowed)`)
      }
    }
    
    // If there are column issues, this ticket needs proper regeneration
    if (hasColumnIssues) {
      issues.push('Ticket needs regeneration for proper Housie format')
    }

    return { isValid: issues.length === 0, issues }
  } catch (error) {
    return { isValid: false, issues: [`Error validating ticket: ${error}`] }
  }
}

// Ticket generation function (same as in buy-ticket)
function generateHousieTicket(): HousieTicketGrid {
  const columnRanges = [
    [1, 9], [10, 19], [20, 29], [30, 39], [40, 49],
    [50, 59], [60, 69], [70, 79], [80, 90]
  ]

  const grid: (number | 0)[][] = Array(3).fill(null).map(() => Array(9).fill(0))
  const columnCounts = Array(9).fill(0)
  const columnNumbers: number[][] = Array(9).fill(null).map(() => [])
  
  let totalNumbers = 0
  const targetNumbers = 15
  
  // Generate numbers for each column
  while (totalNumbers < targetNumbers) {
    for (let col = 0; col < 9 && totalNumbers < targetNumbers; col++) {
      if (columnCounts[col] < 3) {
        const canAdd = Math.min(3 - columnCounts[col], targetNumbers - totalNumbers)
        const numbersToAdd = Math.min(canAdd, Math.floor(Math.random() * 2) + 1)
        
        columnCounts[col] += numbersToAdd
        totalNumbers += numbersToAdd
        
        const [min, max] = columnRanges[col]
        const availableNumbers = []
        for (let n = min; n <= max; n++) {
          if (!columnNumbers[col].includes(n)) {
            availableNumbers.push(n)
          }
        }
        
        if (availableNumbers.length >= numbersToAdd) {
          shuffleArray(availableNumbers)
          const selectedNumbers = availableNumbers.slice(0, numbersToAdd).sort((a, b) => a - b)
          columnNumbers[col].push(...selectedNumbers)
        } else {
          columnNumbers[col].push(...availableNumbers.sort((a, b) => a - b))
          totalNumbers -= numbersToAdd - availableNumbers.length
          columnCounts[col] -= numbersToAdd - availableNumbers.length
        }
      }
    }
  }

  // Adjust to exactly 15 numbers
  while (totalNumbers < targetNumbers) {
    for (let col = 0; col < 9; col++) {
      if (columnCounts[col] < 3 && totalNumbers < targetNumbers) {
        const [min, max] = columnRanges[col]
        const availableNumbers = []
        for (let n = min; n <= max; n++) {
          if (!columnNumbers[col].includes(n)) {
            availableNumbers.push(n)
          }
        }
        
        if (availableNumbers.length > 0) {
          const randomNum = availableNumbers[Math.floor(Math.random() * availableNumbers.length)]
          columnNumbers[col].push(randomNum)
          columnNumbers[col].sort((a, b) => a - b)
          columnCounts[col]++
          totalNumbers++
          break
        }
      }
    }
  }

  while (totalNumbers > targetNumbers) {
    for (let col = 0; col < 9; col++) {
      if (columnNumbers[col].length > 0 && totalNumbers > targetNumbers) {
        columnNumbers[col].pop()
        columnCounts[col]--
        totalNumbers--
        break
      }
    }
  }

  // Place numbers in grid ensuring 5 per row
  const rowCounts = [0, 0, 0]
  const allNumbers: { num: number; col: number }[] = []
  
  for (let col = 0; col < 9; col++) {
    for (const num of columnNumbers[col]) {
      allNumbers.push({ num, col })
    }
  }
  
  allNumbers.sort((a, b) => a.col - b.col)
  
  for (const { num, col } of allNumbers) {
    let bestRow = -1
    for (let row = 0; row < 3; row++) {
      if (rowCounts[row] < 5 && grid[row][col] === 0) {
        if (bestRow === -1 || rowCounts[row] < rowCounts[bestRow]) {
          bestRow = row
        }
      }
    }
    
    if (bestRow !== -1) {
      grid[bestRow][col] = num
      rowCounts[bestRow]++
    }
  }

  // Create flat array
  const flatNumbers: number[] = []
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 9; col++) {
      if (grid[row][col] !== 0) {
        flatNumbers.push(grid[row][col] as number)
      }
    }
  }

  return { grid, flatNumbers: flatNumbers.sort((a, b) => a - b) }
}

function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]
  }
}
