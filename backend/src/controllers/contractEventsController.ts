import { Request, Response } from 'express';
import { query } from '../config/database.js';
import logger from '../utils/logger.js';
import { z } from 'zod';

// Pagination schema
const paginationSchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default('20'),
});

export class ContractEventsController {
  static async listByContract(req: Request, res: Response) {
    try {
      const { contractId } = req.params;
      const page = Math.max(Number.parseInt((req.query.page as string) || '1', 10), 1);
      const limit = Math.min(
        Math.max(Number.parseInt((req.query.limit as string) || '20', 10), 1),
        100
      );
      const offset = (page - 1) * limit;
      const eventTypeRaw = req.query.eventType;
      const eventType = typeof eventTypeRaw === 'string' ? eventTypeRaw.trim() : undefined;
      const categoryRaw = req.query.category;
      const category = typeof categoryRaw === 'string' ? categoryRaw.trim() : undefined;

      const params: Array<string | number> = [contractId as string];

      let whereClause = 'WHERE contract_id = $1';

      if (eventType) {
        params.push(eventType);
        whereClause += ` AND event_type = $${params.length}`;
      }

      if (category) {
        params.push(category);
        whereClause += ` AND category = $${params.length}`;
      }

      const countResult = await query(
        `SELECT COUNT(*)::int AS total
         FROM contract_events
         ${whereClause}`,
        params
      );

      params.push(limit);
      params.push(offset);
      const dataResult = await query(
        `SELECT event_id, contract_id, event_type, payload, ledger_sequence, tx_hash, created_at
         FROM contract_events
         ${whereClause}
         ORDER BY ledger_sequence DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );

      res.json({
        success: true,
        data: dataResult.rows,
        pagination: {
          page,
          limit,
          total: countResult.rows[0]?.total || 0,
          totalPages: Math.ceil((countResult.rows[0]?.total || 0) / limit),
        },
      });
    } catch (error) {
      logger.error('Failed to fetch contract events:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch contract events',
      });
    }
  }

  static async getEventStats(req: Request, res: Response) {
    try {
      const { contractId } = req.params;
      
      if (!contractId) {
        res.status(400).json({ error: 'Contract ID is required' });
        return;
      }

      // Get event statistics
      const statsQuery = `
        SELECT 
          event_type,
          COUNT(*) as count,
          MIN(ledger_sequence) as first_ledger,
          MAX(ledger_sequence) as latest_ledger,
          MIN(created_at) as first_seen,
          MAX(created_at) as last_seen
        FROM contract_events
        WHERE contract_id = $1
        GROUP BY event_type
        ORDER BY count DESC
      `;

      const statsResult = await query(statsQuery, [contractId]);
      const stats = statsResult.rows;

      // Get overall contract stats
      const overallQuery = `
        SELECT 
          COUNT(*) as total_events,
          MIN(ledger_sequence) as first_ledger,
          MAX(ledger_sequence) as latest_ledger,
          MIN(created_at) as first_seen,
          MAX(created_at) as last_seen
        FROM contract_events
        WHERE contract_id = $1
      `;

      const overallResult = await query(overallQuery, [contractId]);
      const overall = overallResult.rows[0];

      res.json({
        success: true,
        data: {
          contract: {
            id: contractId,
            ...overall,
          },
          eventTypes: stats,
        },
      });

    } catch (error) {
      logger.error('Failed to get event statistics:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to get event statistics' 
      });
    }
  }

  static async searchEvents(req: Request, res: Response) {
    try {
      const { contractId } = req.params;
      const { query: searchQuery, eventType, ledgerFrom, ledgerTo } = req.query;
      
      if (!contractId) {
        res.status(400).json({ error: 'Contract ID is required' });
        return;
      }

      // Validate pagination parameters
      const pagination = paginationSchema.parse(req.query);
      const { page, limit } = pagination;
      const offset = (page - 1) * limit;

      // Build WHERE conditions
      const conditions: string[] = ['contract_id = $1'];
      const params: any[] = [contractId];
      let paramIndex = 2;

      if (eventType) {
        conditions.push(`event_type = $${paramIndex++}`);
        params.push(eventType);
      }

      if (ledgerFrom) {
        conditions.push(`ledger_sequence >= $${paramIndex++}`);
        params.push(ledgerFrom);
      }

      if (ledgerTo) {
        conditions.push(`ledger_sequence <= $${paramIndex++}`);
        params.push(ledgerTo);
      }

      if (searchQuery) {
        conditions.push(`payload::text ILIKE $${paramIndex++}`);
        params.push(`%${searchQuery}%`);
      }

      const whereClause = conditions.join(' AND ');

      // Get total count for pagination
      const countQuery = `
        SELECT COUNT(*) as total
        FROM contract_events
        WHERE ${whereClause}
      `;
      
      const countResult = await query(countQuery, params);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated events
      const eventsQuery = `
        SELECT 
          id,
          event_id,
          contract_id,
          event_type,
          payload,
          ledger_sequence,
          tx_hash,
          created_at
        FROM contract_events
        WHERE ${whereClause}
        ORDER BY ledger_sequence DESC, created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;

      params.push(limit, offset);
      const eventsResult = await query(eventsQuery, params);
      const events = eventsResult.rows;

      // Calculate pagination metadata
      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      res.json({
        success: true,
        data: events,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: total,
          itemsPerPage: limit,
          hasNextPage,
          hasPrevPage,
        },
        search: {
          contractId,
          filters: {
            query: searchQuery,
            eventType,
            ledgerFrom,
            ledgerTo,
          },
          totalResults: total,
        },
      });

    } catch (error) {
      logger.error('Failed to search contract events:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to search contract events' 
      });
    }
  }

  static async getIndexerStatus(req: Request, res: Response) {
    try {
      // Get indexer state
      const stateQuery = `
        SELECT last_ledger_sequence, updated_at
        FROM contract_event_index_state
        WHERE state_key = 'soroban_events'
      `;

      const stateResult = await query(stateQuery);
      const state = stateResult.rows[0];

      // Get latest ledger from Stellar (optional - for comparison)
      let latestLedger = null;
      try {
        // This would require Stellar SDK import, keeping it simple for now
        latestLedger = 'N/A'; // Placeholder
      } catch (error) {
        logger.debug('Could not fetch latest ledger from Stellar:', error);
      }

      res.json({
        success: true,
        data: {
          indexer: {
            isRunning: true, // This would be dynamic in a real implementation
            lastIndexedLedger: state?.last_ledger_sequence || 0,
            lastUpdated: state?.updated_at,
            latestStellarLedger: latestLedger,
          },
        },
      });

    } catch (error) {
      logger.error('Failed to get indexer status:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to get indexer status' 
      });
    }
  }
}
