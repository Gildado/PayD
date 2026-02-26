import { Request, Response } from 'express';
import { query } from '../config/database';

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
      const eventType = (req.query.eventType as string | undefined)?.trim();

      const params: Array<string | number> = [contractId];
      let whereClause = 'WHERE contract_id = $1';
      if (eventType) {
        params.push(eventType);
        whereClause += ` AND event_type = $${params.length}`;
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
      console.error('Failed to fetch contract events:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch contract events',
      });
    }
  }
}
