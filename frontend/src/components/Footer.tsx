import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BrandLogo } from './BrandLogo';
import { useNetworkStore } from '../stores/networkStore';
import { Github, Twitter, MessageSquare, Linkedin, ExternalLink } from 'lucide-react';

interface FooterProps {
  className?: string;
}

const APP_VERSION = (import.meta.env.PUBLIC_APP_VERSION as string | undefined)?.trim() ?? '0.0.1';
const APP_ENV = import.meta.env.MODE;

export const Footer: React.FC<FooterProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const { network } = useNetworkStore();
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className={`border-t border-(--border-hi) bg-(--surface) text-(--text) transition-colors duration-(--motion-duration-normal) ${className}`}
      aria-label="Site Footer"
    >
      {/* Main Link Columns Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-8 lg:gap-12">
          {/* Brand & Mission Column (spans 2 cols on desktop) */}
          <div className="sm:col-span-2 flex flex-col justify-between">
            <div>
              <NavLink
                to="/"
                className="inline-flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-(--accent)/50"
                aria-label="PayD Home"
              >
                <BrandLogo />
                <span className="text-[10px] font-mono text-(--muted) tracking-widest uppercase border border-(--border-hi) px-1.5 py-0.5 rounded ml-1">
                  MAINNET
                </span>
              </NavLink>
              <p className="mt-4 text-sm text-(--muted) leading-relaxed max-w-sm">
                {t(
                  'footer.tagline',
                  'Automated, non-custodial workforce payroll engine built on Stellar Soroban smart contracts. Fast, auditable, and transparent global disbursements.'
                )}
              </p>
            </div>

            {/* Social Links */}
            <div className="mt-6 flex items-center gap-3">
              <a
                href="https://github.com/Gildado/PayD"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="PayD GitHub Repository"
                className="w-9 h-9 rounded-full bg-(--surface-hi) border border-(--border) flex items-center justify-center text-(--muted) hover:text-(--accent) hover:border-(--accent)/40 transition-colors focus-visible:ring-2 focus-visible:ring-(--accent)/50 outline-none"
              >
                <Github className="w-4 h-4" aria-hidden="true" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="PayD Twitter / X"
                className="w-9 h-9 rounded-full bg-(--surface-hi) border border-(--border) flex items-center justify-center text-(--muted) hover:text-(--accent) hover:border-(--accent)/40 transition-colors focus-visible:ring-2 focus-visible:ring-(--accent)/50 outline-none"
              >
                <Twitter className="w-4 h-4" aria-hidden="true" />
              </a>
              <a
                href="https://discord.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="PayD Community Discord"
                className="w-9 h-9 rounded-full bg-(--surface-hi) border border-(--border) flex items-center justify-center text-(--muted) hover:text-(--accent) hover:border-(--accent)/40 transition-colors focus-visible:ring-2 focus-visible:ring-(--accent)/50 outline-none"
              >
                <MessageSquare className="w-4 h-4" aria-hidden="true" />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="PayD LinkedIn"
                className="w-9 h-9 rounded-full bg-(--surface-hi) border border-(--border) flex items-center justify-center text-(--muted) hover:text-(--accent) hover:border-(--accent)/40 transition-colors focus-visible:ring-2 focus-visible:ring-(--accent)/50 outline-none"
              >
                <Linkedin className="w-4 h-4" aria-hidden="true" />
              </a>
            </div>
          </div>

          {/* Product Column */}
          <nav aria-label="Product navigation" className="flex flex-col">
            <h3 className="text-xs font-bold uppercase tracking-widest text-(--text) font-[var(--font-head)] mb-4">
              {t('footer.colProduct', 'Product')}
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <NavLink
                  to="/payroll/scheduler"
                  className="text-(--muted) hover:text-(--accent) transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-(--accent)/50"
                >
                  {t('footer.payrollScheduler', 'Payroll Scheduler')}
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/payroll/bulk"
                  className="text-(--muted) hover:text-(--accent) transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-(--accent)/50"
                >
                  {t('footer.bulkUpload', 'Bulk CSV Payouts')}
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/vesting"
                  className="text-(--muted) hover:text-(--accent) transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-(--accent)/50"
                >
                  {t('footer.vestingVaults', 'Escrow & Vesting')}
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/cross-asset"
                  className="text-(--muted) hover:text-(--accent) transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-(--accent)/50"
                >
                  {t('footer.crossAsset', 'Cross-Asset Swaps')}
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/portal"
                  className="text-(--muted) hover:text-(--accent) transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-(--accent)/50"
                >
                  {t('footer.employeePortal', 'Employee Portal')}
                </NavLink>
              </li>
            </ul>
          </nav>

          {/* Company Column */}
          <nav aria-label="Company navigation" className="flex flex-col">
            <h3 className="text-xs font-bold uppercase tracking-widest text-(--text) font-[var(--font-head)] mb-4">
              {t('footer.colCompany', 'Company')}
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a
                  href="#about"
                  className="text-(--muted) hover:text-(--accent) transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-(--accent)/50"
                >
                  {t('footer.about', 'About PayD')}
                </a>
              </li>
              <li>
                <NavLink
                  to="/rewards"
                  className="text-(--muted) hover:text-(--accent) transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-(--accent)/50"
                >
                  {t('footer.contributorRewards', 'Contributor Rewards')}
                </NavLink>
              </li>
              <li>
                <a
                  href="#audits"
                  className="text-(--muted) hover:text-(--accent) transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-(--accent)/50"
                >
                  {t('footer.securityAudits', 'Security Audits')}
                </a>
              </li>
              <li>
                <a
                  href="#roadmap"
                  className="text-(--muted) hover:text-(--accent) transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-(--accent)/50"
                >
                  {t('footer.roadmap', 'Mainnet Roadmap')}
                </a>
              </li>
              <li>
                <a
                  href="#careers"
                  className="text-(--muted) hover:text-(--accent) transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-(--accent)/50"
                >
                  {t('footer.careers', 'Careers')}
                </a>
              </li>
            </ul>
          </nav>

          {/* Resources Column */}
          <nav aria-label="Resources navigation" className="flex flex-col">
            <h3 className="text-xs font-bold uppercase tracking-widest text-(--text) font-[var(--font-head)] mb-4">
              {t('footer.colResources', 'Resources')}
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a
                  href="https://developers.stellar.org/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-(--muted) hover:text-(--accent) transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-(--accent)/50"
                >
                  <span>{t('footer.stellarDocs', 'Soroban Docs')}</span>
                  <ExternalLink className="w-3 h-3 opacity-60" aria-hidden="true" />
                </a>
              </li>
              <li>
                <NavLink
                  to="/help"
                  className="text-(--muted) hover:text-(--accent) transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-(--accent)/50"
                >
                  {t('footer.helpCenter', 'Help Center')}
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/developer/webhooks"
                  className="text-(--muted) hover:text-(--accent) transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-(--accent)/50"
                >
                  {t('footer.webhooks', 'Webhook Logs')}
                </NavLink>
              </li>
              <li>
                <a
                  href="#status"
                  className="text-(--muted) hover:text-(--accent) transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-(--accent)/50"
                >
                  {t('footer.status', 'System Status')}
                </a>
              </li>
            </ul>
          </nav>

          {/* Legal Column */}
          <nav aria-label="Legal navigation" className="flex flex-col">
            <h3 className="text-xs font-bold uppercase tracking-widest text-(--text) font-[var(--font-head)] mb-4">
              {t('footer.colLegal', 'Legal')}
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a
                  href="#terms"
                  className="text-(--muted) hover:text-(--accent) transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-(--accent)/50"
                >
                  {t('footer.terms', 'Terms of Service')}
                </a>
              </li>
              <li>
                <a
                  href="#privacy"
                  className="text-(--muted) hover:text-(--accent) transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-(--accent)/50"
                >
                  {t('footer.privacy', 'Privacy Policy')}
                </a>
              </li>
              <li>
                <a
                  href="http://www.apache.org/licenses/LICENSE-2.0"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-(--accent) hover:underline transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-(--accent)/50"
                >
                  Open Source Notice
                </a>
              </li>
              <li>
                <a
                  href="#compliance"
                  className="text-(--muted) hover:text-(--accent) transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-(--accent)/50"
                >
                  {t('footer.compliance', 'Smart Contract Disclaimer')}
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Sub-footer / Bottom Bar */}
      <div className="border-t border-(--border) bg-(--surface-hi)/40 py-5 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-(--muted)">
          <div>
            <span>
              © {currentYear} PayD — Licensed under the{' '}
              <a
                href="http://www.apache.org/licenses/LICENSE-2.0"
                target="_blank"
                rel="noopener noreferrer"
                className="text-(--accent) hover:underline focus-visible:ring-2 focus-visible:ring-(--accent)/50 rounded outline-none"
              >
                Apache License 2.0
              </a>
            </span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <span
              className="px-2 py-0.5 rounded border border-(--border-hi) text-[10px] uppercase tracking-widest bg-(--surface)"
              aria-label={`App version ${APP_VERSION}`}
            >
              v{APP_VERSION}
            </span>
            <span
              className={`px-2 py-0.5 rounded border text-[10px] uppercase tracking-widest bg-(--surface) ${
                APP_ENV === 'production'
                  ? 'border-(--success)/40 text-(--success)'
                  : 'border-(--status-pending)/40 text-(--status-pending)'
              }`}
              aria-label={`Environment: ${APP_ENV}`}
            >
              {APP_ENV === 'production' ? 'production' : APP_ENV === 'staging' ? 'staging' : 'dev'}
            </span>
            <div
              className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-(--border-hi) bg-(--surface)"
              aria-label={`Connected to Stellar ${network}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shadow-[0_0_6px_var(--accent)] ${
                  network === 'TESTNET' ? 'bg-(--status-pending)' : 'bg-(--accent)'
                }`}
                aria-hidden="true"
              />
              <span>STELLAR · {network}</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
