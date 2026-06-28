export interface OrgUsdAsset {
  code: 'ORGUSD';
}

export interface XlmAsset {
  code: 'XLM';
}

export type StellarAsset = OrgUsdAsset | XlmAsset;

export interface OrgUsdAmount {
  asset: OrgUsdAsset;
  value: number;
}

export interface XlmAmount {
  asset: XlmAsset;
  value: number;
}

export interface OrgUsdStringAmount {
  asset: OrgUsdAsset;
  value: string;
}

export interface XlmStringAmount {
  asset: XlmAsset;
  value: string;
}
