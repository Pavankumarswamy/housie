# Housie Ticket Migration Guide

This guide explains how to fix existing tickets that don't follow proper Housie rules and migrate them to the correct 3×9 grid format.

## Overview

The ticket migration system identifies and fixes tickets that were created with the old algorithm and don't meet proper Housie standards:

### Proper Housie Rules
- **3 rows × 9 columns** (27 cells total)
- **Exactly 5 numbers per row** (15 numbers total, 12 empty cells)
- **Column ranges**: 1-9, 10-19, 20-29, 30-39, 40-49, 50-59, 60-69, 70-79, 80-90
- **Maximum 3 numbers per column**
- **No duplicate numbers** within a ticket

## How to Use Migration

### 1. Access Admin Panel
- Log in as admin
- Go to **Settings** tab in the admin panel
- You'll see the **"Ticket Migration & Validation"** section

### 2. Analyze Existing Tickets
1. Click **"Analyze Tickets"** button
2. The system will check all existing tickets against Housie rules
3. View results showing:
   - Total tickets in database
   - Number of valid tickets
   - Number of invalid tickets (with specific issues)

### 3. Fix Invalid Tickets

#### Option A: Dry Run (Recommended First)
1. Click **"Dry Run Fix"** to simulate the migration
2. Review what changes would be made
3. No actual changes are applied to the database

#### Option B: Live Fix
1. Click **"Fix Invalid Tickets"** to apply actual changes
2. Invalid tickets will be regenerated with proper Housie format
3. Game and user associations are preserved
4. Only the ticket numbers are updated

#### Option C: Full Migration
1. Click **"Run Full Migration"** for complete automated process
2. Analyzes and fixes all issues in one operation

### 4. Review Results
- See detailed statistics of processed/fixed/failed tickets
- View any errors that occurred during migration
- Refresh analysis to confirm all tickets are now valid

## What Gets Fixed

### Common Issues Detected:
- ❌ Wrong number of numbers (not exactly 15)
- ❌ Duplicate numbers within a ticket
- ❌ Numbers outside valid range (1-90)
- ❌ More than 3 numbers in any column
- ❌ Incorrect column distributions

### What Stays the Same:
- ✅ Game ID and associations
- ✅ User ID and ownership
- ✅ Purchase timestamp
- ✅ Claimed prizes history

### What Gets Updated:
- 🔄 Ticket numbers (regenerated with proper format)
- 🔄 Last updated timestamp

## Safety Features

### Built-in Protections:
- **Dry Run Mode**: Test changes before applying
- **Validation**: All new tickets are validated before saving
- **Error Handling**: Failed updates don't affect other tickets
- **Rollback Safe**: Original associations preserved

### Edge Function Support:
- Uses Supabase edge functions when available for better performance
- Automatic fallback to client-side processing if needed
- Progress tracking and detailed logging

## Technical Details

### Validation Rules:
```typescript
✅ Exactly 15 unique numbers (1-90)
✅ 3 rows × 9 columns layout
✅ Exactly 5 numbers per row
✅ Maximum 3 numbers per column
✅ Correct column ranges:
   Col 1: 1-9    Col 6: 50-59
   Col 2: 10-19  Col 7: 60-69
   Col 3: 20-29  Col 8: 70-79
   Col 4: 30-39  Col 9: 80-90
   Col 5: 40-49
```

### Performance:
- Processes tickets in batches to avoid database overload
- Progress tracking for large migrations
- Optimized queries to minimize database load

## Troubleshooting

### If Migration Fails:
1. Check database connectivity
2. Verify admin permissions
3. Try smaller batches (dry run first)
4. Check browser console for detailed error messages

### If Some Tickets Can't Be Fixed:
- Review error messages in the results
- Check for database constraints
- Manually verify problematic ticket data

### If Edge Function is Unavailable:
- System automatically falls back to client-side processing
- May be slower for large numbers of tickets
- All functionality remains available

## Best Practices

1. **Always run analysis first** to understand the scope
2. **Use dry run mode** before applying real changes
3. **Backup your database** before major migrations (recommended)
4. **Run migration during low-traffic periods** for better performance
5. **Verify results** by analyzing tickets after migration

## Example Migration Flow

```bash
1. Analyze Tickets → "Found 45 invalid tickets"
2. Dry Run Fix → "Would fix 45 tickets successfully"  
3. Fix Invalid Tickets → "Fixed 45 out of 45 tickets"
4. Analyze Again → "All 150 tickets are now valid!"
```

## Support

If you encounter issues with ticket migration:
1. Check the error messages in the admin panel
2. Review browser developer console for detailed logs
3. Verify database permissions and connectivity
4. Contact system administrator if problems persist

---

**Note**: This migration only needs to be run once after upgrading to the new Housie ticket algorithm. All new tickets will automatically follow proper Housie rules.
