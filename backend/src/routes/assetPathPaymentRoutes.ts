import { Router, Request, Response, NextFunction } from 'express';
import { assetPathPaymentService } from '../services/assetPathPaymentService.js';
import authenticateJWT from '../middlewares/auth.js';
import logger from '../utils/logger.js';
import { z } from 'zod';

const router = Router();

router.use(authenticateJWT);

const assetInfoSchema = z.object({
  code: z.string().min(1),
  issuer: z.string().optional(),
  isNative: z.boolean().optional(),
});

const pathFindSchema = z.object({
  sourceAsset: assetInfoSchema,
  destinationAsset: assetInfoSchema,
  amount: z.string().min(1),
  amountType: z.enum(['source', 'destination']).default('source'),
  maximumSlippage: z.number().min(0).max(100).optional(),
  maximumPriceImpact: z.number().min(0).max(100).optional(),
});

const executePathPaymentSchema = z.object({
  sourceAccount: z.string().startsWith('G'),
  destinationAccount: z.string().startsWith('G'),
  sourceAsset: assetInfoSchema,
  destinationAsset: assetInfoSchema,
  sourceAmount: z.string().optional(),
  destinationAmount: z.string().optional(),
  maximumSourceAmount: z.string().min(1),
  minimumDestinationAmount: z.string().min(1),
  pathId: z.string().optional(),
  memo: z.string().max(28).optional(),
});

router.get(
  '/supported-assets',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const assets = await assetPathPaymentService.getSupportedAssets();
      res.json({
        success: true,
        data: assets,
        count: assets.length,
      });
    } catch (error) {
      logger.error('Failed to get supported assets', { error });
      next(error);
    }
  }
);

router.post(
  '/find-paths',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = pathFindSchema.parse(req.body);

      logger.info('Finding payment paths', {
        sourceAsset: validatedData.sourceAsset.code,
        destinationAsset: validatedData.destinationAsset.code,
        amount: validatedData.amount,
        amountType: validatedData.amountType,
      });

      const paths = await assetPathPaymentService.findOptimalPath(validatedData);

      if (paths.length === 0) {
        res.status(404).json({
          success: false,
          error: 'No valid payment paths found for the given asset pair and amount',
        });
        return;
      }

      res.json({
        success: true,
        data: paths,
        count: paths.length,
        optimalPath: paths.find((p) => p.optimal)?.id,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.issues,
        });
        return;
      }
      logger.error('Failed to find payment paths', { error });
      next(error);
    }
  }
);

router.post(
  '/estimate-slippage',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { path, amount } = req.body;

      if (!path || !amount) {
        res.status(400).json({
          success: false,
          error: 'path and amount are required',
        });
        return;
      }

      const estimate = await assetPathPaymentService.estimateSlippage(path, amount);

      res.json({
        success: true,
        data: estimate,
      });
    } catch (error) {
      logger.error('Failed to estimate slippage', { error });
      next(error);
    }
  }
);

router.post('/execute', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validatedData = executePathPaymentSchema.parse(req.body);

    if (!validatedData.sourceAmount && !validatedData.destinationAmount) {
      res.status(400).json({
        success: false,
        error: 'Either sourceAmount or destinationAmount must be provided',
      });
      return;
    }

    let path = req.body.path;
    if (!path && validatedData.pathId) {
      const paths = await assetPathPaymentService.findOptimalPath({
        sourceAsset: validatedData.sourceAsset,
        destinationAsset: validatedData.destinationAsset,
        amount: validatedData.sourceAmount || validatedData.maximumSourceAmount,
        amountType: 'source',
      });
      path = paths.find((p) => p.id === validatedData.pathId) || paths[0];
    }

    if (!path) {
      res.status(400).json({
        success: false,
        error: 'No payment path provided. Use /find-paths to get available paths.',
      });
      return;
    }

    logger.info('Executing path payment', {
      sourceAccount: validatedData.sourceAccount,
      destinationAccount: validatedData.destinationAccount,
      sourceAsset: validatedData.sourceAsset.code,
      destinationAsset: validatedData.destinationAsset.code,
      maximumSourceAmount: validatedData.maximumSourceAmount,
      minimumDestinationAmount: validatedData.minimumDestinationAmount,
    });

    const result = await assetPathPaymentService.executePathPayment({
      ...validatedData,
      path,
    });

    if (result.success) {
      res.json({
        success: true,
        data: {
          txHash: result.txHash,
          ledger: result.ledger,
          actualSourceAmount: result.actualSourceAmount,
          actualDestinationAmount: result.actualDestinationAmount,
          effectiveRate: result.effectiveRate,
        },
      });
    } else {
      const statusCode = result.partialFailure ? 422 : 400;
      res.status(statusCode).json({
        success: false,
        error: result.error,
        partialFailure: result.partialFailure,
        partialAmount: result.partialAmount,
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.issues,
      });
      return;
    }
    logger.error('Failed to execute path payment', { error });
    next(error);
  }
});

router.get(
  '/liquidity-pools',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { baseCode, baseIssuer, quoteCode, quoteIssuer } = req.query;

      let assetPair;
      if (baseCode && quoteCode) {
        assetPair = {
          base: {
            code: baseCode as string,
            issuer: baseIssuer as string | undefined,
            isNative: baseCode === 'XLM',
          },
          quote: {
            code: quoteCode as string,
            issuer: quoteIssuer as string | undefined,
            isNative: quoteCode === 'XLM',
          },
        };
      }

      const pools = await assetPathPaymentService.getLiquidityPools(assetPair);

      res.json({
        success: true,
        data: pools,
        count: pools.length,
      });
    } catch (error) {
      logger.error('Failed to get liquidity pools', { error });
      next(error);
    }
  }
);

router.get(
  '/liquidity-pools/stats',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await assetPathPaymentService.getLiquidityPoolStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Failed to get liquidity pool stats', { error });
      next(error);
    }
  }
);

router.get(
  '/compare-rates',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sourceAssetCode, destAssetCode, amount } = req.query;

      if (!sourceAssetCode || !destAssetCode || !amount) {
        res.status(400).json({
          success: false,
          error: 'sourceAssetCode, destAssetCode, and amount are required',
        });
        return;
      }

      const sourceAsset = {
        code: sourceAssetCode as string,
        isNative: sourceAssetCode === 'XLM',
      };

      const destinationAsset = {
        code: destAssetCode as string,
        isNative: destAssetCode === 'XLM',
      };

      const paths = await assetPathPaymentService.findOptimalPath({
        sourceAsset,
        destinationAsset,
        amount: amount as string,
        amountType: 'source',
      });

      if (paths.length === 0) {
        res.status(404).json({
          success: false,
          error: 'No paths found for the given asset pair',
        });
        return;
      }

      const comparison = paths.map((path) => ({
        pathId: path.id,
        route: path.hops.map((h) => h.asset.code).join(' → '),
        sourceAmount: path.sourceAmount,
        destinationAmount: path.destinationAmount,
        rate: path.rate,
        fee: path.fee,
        slippage: path.slippage,
        priceImpact: path.priceImpact,
        optimal: path.optimal,
      }));

      res.json({
        success: true,
        data: {
          sourceAsset: sourceAssetCode,
          destinationAsset: destAssetCode,
          inputAmount: amount,
          paths: comparison,
          bestRate: Math.max(...paths.map((p) => p.rate)),
          lowestFee: Math.min(...paths.map((p) => p.fee)),
          lowestSlippage: Math.min(...paths.map((p) => p.slippage)),
        },
      });
    } catch (error) {
      logger.error('Failed to compare rates', { error });
      next(error);
    }
  }
);

export default router;
