export const ORGANIZATION_SETTINGS_KEY = 'payd-org-settings';
export const PREFERRED_STABLECOIN_KEY = 'preferredStablecoin';

export const PREFERRED_STABLECOINS = ['USDC', 'EURC', 'ORGUSD'] as const;

export type PreferredStablecoin = (typeof PREFERRED_STABLECOINS)[number];

export interface OrganizationSettingsData {
  contactEmail: string;
  contactPhone: string;
  preferredStablecoin: PreferredStablecoin;
}

export const DEFAULT_ORGANIZATION_SETTINGS: OrganizationSettingsData = {
  contactEmail: '',
  contactPhone: '',
  preferredStablecoin: 'USDC',
};

function isPreferredStablecoin(value: unknown): value is PreferredStablecoin {
  return PREFERRED_STABLECOINS.includes(value as PreferredStablecoin);
}

export function readOrganizationSettings(): OrganizationSettingsData {
  try {
    const raw = localStorage.getItem(ORGANIZATION_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_ORGANIZATION_SETTINGS };

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_ORGANIZATION_SETTINGS };

    const value = parsed as Record<string, unknown>;
    return {
      contactEmail: typeof value.contactEmail === 'string' ? value.contactEmail : '',
      contactPhone: typeof value.contactPhone === 'string' ? value.contactPhone : '',
      preferredStablecoin: isPreferredStablecoin(value.preferredStablecoin)
        ? value.preferredStablecoin
        : DEFAULT_ORGANIZATION_SETTINGS.preferredStablecoin,
    };
  } catch {
    return { ...DEFAULT_ORGANIZATION_SETTINGS };
  }
}

export function saveOrganizationSettings(settings: OrganizationSettingsData): void {
  try {
    localStorage.setItem(ORGANIZATION_SETTINGS_KEY, JSON.stringify(settings));
    localStorage.setItem(PREFERRED_STABLECOIN_KEY, settings.preferredStablecoin);
  } catch {
    return;
  }
}

export function resetOrganizationSettings(): void {
  try {
    localStorage.removeItem(ORGANIZATION_SETTINGS_KEY);
    localStorage.removeItem(PREFERRED_STABLECOIN_KEY);
  } catch {
    return;
  }
}
