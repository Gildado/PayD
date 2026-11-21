import { Horizon, Networks, Asset } from '@stellar/stellar-sdk';
import logger from '../utils/logger.js';

export interface ConversionPath {
  id: string;
  sourceAsset: string;
  destinationAsset: string;
  rate: number;
  fee: number;
  slippage: number;
  estimatedDestinationAmount: number;
  hops: string[];
}

export interface PathfindRequest {
  fromAsset: string;
  toAsset: string;
  amount: number;
}

const HORIZON_URL = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';

const ASSET_CODE_MAPPING: Record<string, { code: string; issuer?: string }> = {
  USDC: { code: 'USDC', issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3KLQEH2Y6DFOUHD7I2DMSK7P' },
  EURT: { code: 'EURT', issuer: 'GBL5IYFWZVGF2V6D2OKP2JO3H3GZJ6B2TQ4G5S5O2NJX4JH7Q3K5ZT6OE' },
  XLM: { code: 'XLM' },
  NGN: { code: 'NGN' },
  BRL: { code: 'BRL' },
  ARS: { code: 'ARS' },
  KES: { code: 'KES' },
};

function getHorizonServer(): Horizon.Server {
  return new Horizon.Server(HORIZON_URL);
}

function normalizeAssetCode(assetCode: string): string {
  const upperCode = assetCode.toUpperCase();
  return ASSET_CODE_MAPPING[upperCode]?.code || upperCode;
}

function createHorizonAsset(assetCode: string): Asset {
  const mapping = ASSET_CODE_MAPPING[assetCode.toUpperCase()];
  if (!mapping || assetCode.toUpperCase() === 'XLM') {
    return Asset.native();
  }
  return new Asset(mapping.code, mapping.issuer);
}

export async function findConversionPaths(request: PathfindRequest): Promise<ConversionPath[]> {
  try {
    const horizonServer = getHorizonServer();
    const sourceAsset = createHorizonAsset(request.fromAsset);
    const destAsset = createHorizonAsset(request.toAsset);

    const response = await fetch(
      `${HORIZON_URL}/paths?source_asset_type=${sourceAsset.isNative() ? 'native' : `${sourceAsset.getCode()}:${sourceAsset.getIssuer()}`}` +
        `&destination_asset_type=${destAsset.isNative() ? 'native' : `${destAsset.getCode()}:${destAsset.getIssuer()}`}` +
        `&source_amount=${request.amount}`
    );

    if (!response.ok) {
      logger.warn('Horizon path API error', { status: response.status });
      return generateFallbackPaths(request);
    }

    const rawPaths = (await response.json()) as {
      records?: Array<{
        source_asset_code?: string;
        destination_asset_code?: string;
        source_amount?: string;
        destination_amount?: string;
      }>;
    };

    if (!rawPaths.records || rawPaths.records.length === 0) {
      return generateFallbackPaths(request);
    }

    const paths: ConversionPath[] = rawPaths.records.slice(0, 10).map((rawPath) => {
      const sourceAmount = rawPath.source_amount || '0';
      const destAmount = rawPath.destination_amount || '0';
      const sourceRate =
        parseFloat(sourceAmount) > 0 ? parseFloat(destAmount) / parseFloat(sourceAmount) : 0;
      const baseFeePercent = 0.006;
      const fee = request.amount * baseFeePercent;
      const slippageEstimate = 0.35;

      return {
        id: `path-${rawPath.source_asset_code || 'unknown'}-${rawPath.destination_asset_code || 'unknown'}-${Math.random().toString(36).slice(2, 8)}`,
        sourceAsset: normalizeAssetCode(rawPath.source_asset_code || 'XLM'),
        destinationAsset: normalizeAssetCode(rawPath.destination_asset_code || 'XLM'),
        rate: sourceRate,
        fee,
        slippage: slippageEstimate,
        estimatedDestinationAmount: parseFloat(destAmount) - fee,
        hops: [request.fromAsset, rawPath.source_asset_code || 'XLM', request.toAsset],
      };
    });

    return paths;
  } catch (error) {
    logger.error('Error fetching Horizon paths', error);
    return generateFallbackPaths(request);
  }
}

function generateFallbackPaths(request: PathfindRequest): ConversionPath[] {
  const baseRates: Record<string, number> = {
    NGN: 1550,
    BRL: 5.1,
    ARS: 1200,
    KES: 150,
  };

  const baseRate = baseRates[request.toAsset] || 1.0;
  const fastFee = request.amount * 0.006;
  const cheapFee = request.amount * 0.003;

  return [
    {
      id: 'path-fast',
      sourceAsset: request.fromAsset,
      destinationAsset: request.toAsset,
      rate: baseRate,
      fee: fastFee,
      slippage: 0.35,
      estimatedDestinationAmount: request.amount * baseRate - fastFee,
      hops: [request.fromAsset, 'XLM', request.toAsset],
    },
    {
      id: 'path-cheap',
      sourceAsset: request.fromAsset,
      destinationAsset: request.toAsset,
      rate: baseRate * 0.994,
      fee: cheapFee,
      slippage: 0.8,
      estimatedDestinationAmount: request.amount * baseRate * 0.994 - cheapFee,
      hops: [request.fromAsset, 'USDC', request.toAsset],
    },
  ];
}
