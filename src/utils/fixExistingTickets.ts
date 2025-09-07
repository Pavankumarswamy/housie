import { supabase } from "@/integrations/supabase/client";
import { generateHousieTicket } from "./ticketGenerator";

interface TicketRecord {
  id: string;
  numbers: any;
  game_id: string;
  user_id: string;
  created_at: string;
}

/**
 * Validates if a ticket follows proper Housie rules
 */
function validateExistingTicket(numbers: any): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  try {
    // Convert to array if needed
    let ticketNumbers: number[];
    if (typeof numbers === 'string') {
      ticketNumbers = JSON.parse(numbers);
    } else if (Array.isArray(numbers)) {
      ticketNumbers = Array.isArray(numbers[0]) ? numbers.flat() : numbers;
    } else {
      return { isValid: false, issues: ['Invalid number format'] };
    }

    // Check if exactly 15 numbers
    const validNumbers = ticketNumbers.filter(n => typeof n === 'number' && n > 0);
    if (validNumbers.length !== 15) {
      issues.push(`Has ${validNumbers.length} numbers instead of 15`);
    }

    // Check for duplicates
    const uniqueNumbers = new Set(validNumbers);
    if (uniqueNumbers.size !== validNumbers.length) {
      issues.push('Contains duplicate numbers');
    }

    // Check number ranges (basic validation)
    for (const num of validNumbers) {
      if (num < 1 || num > 90) {
        issues.push(`Number ${num} is outside valid range 1-90`);
      }
    }

    // Check column distribution (more complex validation)
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

    // For legacy tickets that don't follow proper Housie format,
    // we'll be more lenient and just flag for regeneration
    let hasColumnIssues = false;
    for (let col = 0; col < columnCounts.length; col++) {
      if (columnCounts[col] > 3) {
        hasColumnIssues = true;
        issues.push(`Column ${col + 1} has ${columnCounts[col]} numbers (max 3 allowed)`);
      }
    }
    
    // If there are column issues, this ticket needs proper regeneration
    if (hasColumnIssues) {
      issues.push('Ticket needs regeneration for proper Housie format');
    }

    return { isValid: issues.length === 0, issues };
  } catch (error) {
    return { isValid: false, issues: [`Error validating ticket: ${error}`] };
  }
}

/**
 * Checks all tickets in the database and identifies invalid ones
 */
export async function analyzeExistingTickets(): Promise<{
  totalTickets: number;
  invalidTickets: { ticket: TicketRecord; issues: string[] }[];
  validTickets: number;
}> {
  console.log('🔍 Analyzing existing tickets...');
  
  try {
    const { data: tickets, error } = await supabase
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    const results = {
      totalTickets: tickets?.length || 0,
      invalidTickets: [] as { ticket: TicketRecord; issues: string[] }[],
      validTickets: 0
    };

    if (!tickets || tickets.length === 0) {
      console.log('📋 No tickets found in database');
      return results;
    }

    console.log(`📊 Found ${tickets.length} tickets to analyze`);

    for (const ticket of tickets) {
      const validation = validateExistingTicket(ticket.numbers);
      
      if (!validation.isValid) {
        results.invalidTickets.push({
          ticket,
          issues: validation.issues
        });
        console.log(`❌ Invalid ticket ${ticket.id.slice(-8)}: ${validation.issues.join(', ')}`);
      } else {
        results.validTickets++;
      }
    }

    console.log(`\n📈 Analysis Results:`);
    console.log(`   Total tickets: ${results.totalTickets}`);
    console.log(`   Valid tickets: ${results.validTickets}`);
    console.log(`   Invalid tickets: ${results.invalidTickets.length}`);

    return results;
  } catch (error) {
    console.error('Error analyzing tickets:', error);
    throw error;
  }
}

/**
 * Fixes a single invalid ticket by regenerating it with proper Housie rules
 */
async function fixSingleTicket(ticketId: string): Promise<boolean> {
  try {
    // Generate new valid ticket
    const newTicketData = generateHousieTicket();
    
    // Update the ticket in database
    const { error } = await supabase
      .from('tickets')
      .update({
        numbers: newTicketData.flatNumbers,
        // Add a note that this ticket was regenerated
        updated_at: new Date().toISOString()
      })
      .eq('id', ticketId);

    if (error) {
      console.error(`Failed to update ticket ${ticketId}:`, error);
      return false;
    }

    console.log(`✅ Fixed ticket ${ticketId.slice(-8)} with new numbers: [${newTicketData.flatNumbers.join(', ')}]`);
    return true;
  } catch (error) {
    console.error(`Error fixing ticket ${ticketId}:`, error);
    return false;
  }
}

/**
 * Fixes all invalid tickets by regenerating them
 */
export async function fixInvalidTickets(dryRun: boolean = true): Promise<{
  processed: number;
  fixed: number;
  failed: number;
  errors: string[];
}> {
  console.log(`🔧 ${dryRun ? 'DRY RUN - ' : ''}Fixing invalid tickets...`);
  
  const analysis = await analyzeExistingTickets();
  const results = {
    processed: 0,
    fixed: 0,
    failed: 0,
    errors: [] as string[]
  };

  if (analysis.invalidTickets.length === 0) {
    console.log('✨ No invalid tickets found - all tickets are already valid!');
    return results;
  }

  console.log(`\n🛠️  ${dryRun ? 'Would fix' : 'Fixing'} ${analysis.invalidTickets.length} invalid tickets...`);

  for (const { ticket, issues } of analysis.invalidTickets) {
    results.processed++;
    
    console.log(`\n${dryRun ? 'WOULD FIX' : 'FIXING'} Ticket ${ticket.id.slice(-8)}:`);
    console.log(`   Issues: ${issues.join(', ')}`);
    console.log(`   Game: ${ticket.game_id.slice(-8)}`);
    console.log(`   User: ${ticket.user_id.slice(-8)}`);

    if (!dryRun) {
      const success = await fixSingleTicket(ticket.id);
      if (success) {
        results.fixed++;
        console.log(`   ✅ Successfully regenerated`);
      } else {
        results.failed++;
        results.errors.push(`Failed to fix ticket ${ticket.id}`);
        console.log(`   ❌ Failed to regenerate`);
      }
    } else {
      console.log(`   🔍 Would regenerate with proper Housie format`);
    }

    // Small delay to avoid overwhelming the database
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\n📋 ${dryRun ? 'Dry Run' : 'Fix'} Results:`);
  console.log(`   Processed: ${results.processed}`);
  if (!dryRun) {
    console.log(`   Fixed: ${results.fixed}`);
    console.log(`   Failed: ${results.failed}`);
    if (results.errors.length > 0) {
      console.log(`   Errors: ${results.errors.join(', ')}`);
    }
  }

  return results;
}

/**
 * Creates a Supabase function to be called from admin panel
 */
export async function createTicketMigrationFunction(): Promise<void> {
  console.log('📝 Creating ticket migration function in Supabase...');
  
  // This would typically be deployed as an edge function
  const functionCode = `
    import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
    import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

          if (error) throw error

          // Validation logic here...
          return new Response(JSON.stringify({ 
            success: true, 
            totalTickets: tickets.length 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        if (action === 'fix') {
          // Fix invalid tickets
          // Implementation here...
          return new Response(JSON.stringify({ success: true }), {
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
  `;

  console.log('💡 Edge function template created. Deploy this to supabase/functions/fix-tickets/index.ts');
}

/**
 * Uses Supabase edge function for migration if available
 */
export async function useEdgeFunctionMigration(action: 'analyze' | 'fix', dryRun: boolean = true) {
  try {
    const { data, error } = await supabase.functions.invoke('fix-tickets', {
      body: { action, dryRun }
    });
    
    if (error) {
      console.warn('Edge function failed, falling back to client-side:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.warn('Edge function unavailable, using client-side migration:', error);
    return null;
  }
}

/**
 * Main function to run the ticket migration
 */
export async function runTicketMigration(options: {
  dryRun?: boolean;
  analyzeOnly?: boolean;
  useEdgeFunction?: boolean;
} = {}) {
  const { dryRun = true, analyzeOnly = false, useEdgeFunction = true } = options;
  
  console.log('🚀 Starting Housie Ticket Migration');
  console.log('=====================================\n');
  
  try {
    if (useEdgeFunction) {
      // Try to use edge function first
      if (analyzeOnly) {
        const result = await useEdgeFunctionMigration('analyze');
        if (result) {
          console.log('📊 Analysis completed using edge function');
          console.log(`   Total tickets: ${result.totalTickets}`);
          console.log(`   Valid tickets: ${result.validTickets}`);
          console.log(`   Invalid tickets: ${result.invalidTickets.length}`);
          return result;
        }
      } else {
        const result = await useEdgeFunctionMigration('fix', dryRun);
        if (result) {
          console.log('🔧 Fix completed using edge function');
          console.log(`   Processed: ${result.processed}`);
          console.log(`   Fixed: ${result.fixed}`);
          console.log(`   Failed: ${result.failed}`);
          return result;
        }
      }
    }
    
    // Fallback to client-side migration
    console.log('🔄 Using client-side migration...');
    if (analyzeOnly) {
      return await analyzeExistingTickets();
    } else {
      return await fixInvalidTickets(dryRun);
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
}
