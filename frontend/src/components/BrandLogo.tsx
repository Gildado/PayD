import React, { useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { sanitizeLogoUrl, sanitizeOrgName } from '../utils/brand';

/**
 * Header logo: the organization's logo/name when branding is configured
 * (#1505), otherwise the default PayD wordmark.
 */
export const BrandLogo: React.FC = () => {
  const { brandConfig } = useTheme();
  const logoUrl = sanitizeLogoUrl(brandConfig.logoUrl);
  const orgName = sanitizeOrgName(brandConfig.orgName);
  const [logoFailed, setLogoFailed] = useState(false);

  if ((logoUrl && !logoFailed) || orgName) {
    return (
      <span className="flex items-center gap-2.5 min-w-0">
        {logoUrl && !logoFailed && (
          <img
            src={logoUrl}
            alt={orgName ? `${orgName} logo` : 'Organization logo'}
            className="h-8 w-auto max-w-[120px] object-contain"
            onError={() => setLogoFailed(true)}
          />
        )}
        {orgName && (
          <span className="text-lg font-extrabold tracking-tight truncate max-w-[40vw] sm:max-w-[240px]">
            {orgName}
          </span>
        )}
        <span className="sr-only">, powered by PayD</span>
      </span>
    );
  }

  return (
    <>
      <div className="w-8 h-8 rounded-lg grid place-items-center font-extrabold text-black text-sm tracking-tight shadow-[0_0_20px_color-mix(in_srgb,var(--accent)_30%,transparent)] bg-linear-to-br from-(--accent) to-(--accent2)">
        P
      </div>
      <span className="text-lg font-extrabold tracking-tight">
        Pay<span className="text-(--accent)">D</span>
      </span>
    </>
  );
};

export default BrandLogo;
