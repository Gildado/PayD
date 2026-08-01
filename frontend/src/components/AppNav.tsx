import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  Code,
  User,
  Wallet,
  FileText,
  Globe,
  LayoutDashboard,
  Activity,
  ShieldAlert,
  Menu,
  X,
  PieChart,
  Briefcase,
  ChevronDown,
  Layers,
  Gift,
  HelpCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Avatar } from './Avatar';
import { AvatarUpload } from './AvatarUpload';
import { useWallet } from '../hooks/useWallet';
import { formatShortcutKey } from '../utils/keyboardShortcutFormat';

type NavItem = {
  to: string;
  label: string;
  ariaLabel: string;
  icon: React.ReactNode;
  title?: string;
};

const linkClass = (isActive: boolean, variant: 'default' | 'danger' = 'default') =>
  variant === 'danger'
    ? `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition ${
        isActive
          ? 'text-red-500 bg-red-500/10'
          : 'text-red-400 hover:bg-red-500/20 hover:text-red-500'
      }`
    : `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition ${
        isActive
          ? 'text-(--accent) bg-white/5'
          : 'text-(--muted) hover:bg-white/10 hover:text-white'
      }`;

const menuItemClass = (isActive: boolean) =>
  `flex items-center gap-2 px-3 py-2 rounded-md text-[13px] font-medium transition ${
    isActive ? 'text-(--accent) bg-white/5' : 'text-(--muted) hover:bg-white/10 hover:text-white'
  }`;

// ── Grouped nav dropdown (desktop) ───────
interface NavDropdownProps {
  label: string;
  icon: React.ReactNode;
  items: NavItem[];
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  active: boolean;
  variant?: 'default' | 'danger';
}

const NavDropdown: React.FC<NavDropdownProps> = ({
  label,
  icon,
  items,
  isOpen,
  onToggle,
  onClose,
  active,
  variant = 'default',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={onToggle}
        className={linkClass(active || isOpen, variant)}
      >
        <span className="opacity-70" aria-hidden="true">
          {icon}
        </span>
        {label}
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label={label}
          className="absolute right-0 top-[calc(100%+6px)] min-w-52.5 rounded-xl border p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.35)] z-50"
          style={{ background: 'var(--surface)', borderColor: 'var(--border-hi)' }}
        >
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              role="menuitem"
              aria-label={item.ariaLabel}
              title={item.title}
              onClick={onClose}
              className={({ isActive }) => menuItemClass(isActive)}
            >
              <span className="opacity-70" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
};

const AppNav: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<'tools' | 'admin' | null>(null);
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false);
  const [userImageUrl, setUserImageUrl] = useState<string | undefined>(undefined);
  const { address, walletName, isConnecting } = useWallet();
  const closeMobileMenu = () => setMobileOpen(false);

  useEffect(() => {
    const savedImage = localStorage.getItem('payd:user-avatar');
    if (savedImage) {
      setUserImageUrl(savedImage);
    }
  }, []);

  useEffect(() => {
    setOpenMenu(null);
  }, [location.pathname]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      if (isProfileEditorOpen) {
        setIsProfileEditorOpen(false);
      }
      if (mobileOpen) {
        setMobileOpen(false);
      }
      if (openMenu) {
        setOpenMenu(null);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isProfileEditorOpen, mobileOpen, openMenu]);

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [mobileOpen]);

  // Mock user data - replace with actual user context
  const currentUser = {
    email: 'user@example.com',
    name: 'John Doe',
    imageUrl: userImageUrl,
  };

  const primaryLinks: NavItem[] = [
    {
      to: '/employer',
      label: t('nav.employer'),
      ariaLabel: t('nav.employer'),
      icon: <Briefcase className="w-4 h-4" />,
    },
    {
      to: '/payroll',
      label: t('nav.payroll'),
      ariaLabel: t('nav.payroll'),
      title: t('nav.newPayrollShortcut', { key: formatShortcutKey('n') }),
      icon: <Wallet className="w-4 h-4" />,
    },
    {
      to: '/employee',
      label: t('nav.employees'),
      ariaLabel: t('nav.employees'),
      title: t('nav.employeeListShortcut', { key: formatShortcutKey('e') }),
      icon: <User className="w-4 h-4" />,
    },
    {
      to: '/portal',
      label: t('nav.myPortal'),
      ariaLabel: t('nav.myPortal'),
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
  ];

  const toolsLinks: NavItem[] = [
    {
      to: '/reports',
      label: t('nav.reports'),
      ariaLabel: t('nav.reports'),
      icon: <FileText className="w-4 h-4" />,
    },
    {
      to: '/cross-asset-payment',
      label: t('nav.crossAsset'),
      ariaLabel: t('nav.crossAsset'),
      icon: <Globe className="w-4 h-4" />,
    },
    {
      to: '/transactions',
      label: t('nav.history'),
      ariaLabel: t('nav.history'),
      title: t('nav.transactionHistoryShortcut', { key: formatShortcutKey('h') }),
      icon: <Activity className="w-4 h-4" />,
    },
    {
      to: '/revenue-split',
      label: t('nav.revenueSplit'),
      ariaLabel: t('nav.revenueSplit'),
      icon: <PieChart className="w-4 h-4" />,
    },
  ];

  const adminLinks: NavItem[] = [
    {
      to: '/admin',
      label: t('nav.admin'),
      ariaLabel: t('nav.admin'),
      icon: <ShieldAlert className="w-4 h-4" />,
    },
    {
      to: '/debug',
      label: t('nav.debuggerLabel'),
      ariaLabel: t('nav.debuggerLabel'),
      icon: <Code className="w-4 h-4" />,
    },
  ];

  const toolsActive = toolsLinks.some((item) => location.pathname.startsWith(item.to));
  const adminActive = adminLinks.some((item) => location.pathname.startsWith(item.to));

  const mobileSectionLinks = (items: NavItem[], variant: 'default' | 'danger' = 'default') =>
    items.map((item) => (
      <NavLink
        key={item.to}
        to={item.to}
        aria-label={item.ariaLabel}
        title={item.title}
        onClick={closeMobileMenu}
        className={({ isActive }) => linkClass(isActive, variant)}
      >
        <span className="opacity-70" aria-hidden="true">
          {item.icon}
        </span>
        {item.label}
      </NavLink>
    ));

  return (
    <nav className="relative w-full" aria-label={t('nav.primaryNavigation')}>
      <div className="flex items-center justify-between gap-4 px-3 py-2">
        {/* Desktop links */}
        <div className="hidden lg:flex items-center gap-1">
          {primaryLinks.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              aria-label={item.ariaLabel}
              title={item.title}
              className={({ isActive }) => linkClass(isActive)}
            >
              <span className="opacity-70" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}

          <div className="w-px h-5 bg-(--border-hi) mx-1.5" />

          <NavDropdown
            label={t('nav.tools')}
            icon={<Layers className="w-4 h-4" />}
            items={toolsLinks}
            isOpen={openMenu === 'tools'}
            onToggle={() => setOpenMenu((current) => (current === 'tools' ? null : 'tools'))}
            onClose={() => setOpenMenu((current) => (current === 'tools' ? null : current))}
            active={toolsActive}
          />

          <NavDropdown
            label={t('nav.admin')}
            icon={<ShieldAlert className="w-4 h-4" />}
            items={adminLinks}
            isOpen={openMenu === 'admin'}
            onToggle={() => setOpenMenu((current) => (current === 'admin' ? null : 'admin'))}
            onClose={() => setOpenMenu((current) => (current === 'admin' ? null : current))}
            active={adminActive}
            variant="danger"
          />
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          aria-label={mobileOpen ? t('nav.closeMenu') : t('nav.openMenu')}
          aria-expanded={mobileOpen}
          aria-controls="mobile-navigation-drawer"
          aria-haspopup="dialog"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="lg:hidden p-2 rounded-md hover:bg-white/5 transition"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Utility + profile */}
        <div className="ml-auto flex items-center gap-1.5">
          <NavLink
            to="/rewards"
            aria-label={t('nav.rewards')}
            title={t('nav.rewards')}
            className={({ isActive }) =>
              `hidden md:grid place-items-center w-8 h-8 rounded-lg transition ${
                isActive
                  ? 'text-(--accent) bg-white/5'
                  : 'text-(--muted) hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <Gift className="w-4 h-4" />
          </NavLink>

          <Link
            to="/help"
            aria-label={t('common.help')}
            title={t('nav.searchDocumentationShortcut', { key: formatShortcutKey('k') })}
            className="hidden md:grid place-items-center w-8 h-8 rounded-lg text-(--accent) hover:bg-(--accent)/10 transition"
          >
            <HelpCircle className="w-4 h-4" />
          </Link>

          <div className="hidden xl:flex flex-col items-end rounded-lg border border-(--border-hi) bg-(--surface) px-3 py-1.5 ml-1">
            <span className="text-[9px] uppercase tracking-wider text-(--muted)">
              {isConnecting
                ? t('nav.connectingWallet')
                : walletName
                  ? t('nav.walletConnected', { walletName })
                  : t('nav.wallet')}
            </span>
            <span className="text-[11px] font-mono text-(--accent)">
              {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : t('nav.notConnected')}
            </span>
          </div>
          <button
            type="button"
            className="p-1 rounded-lg flex items-center gap-2 cursor-pointer border border-(--border-hi) bg-(--surface) hover:bg-(--surface-hi) transition"
            onClick={() => setIsProfileEditorOpen(true)}
            aria-label={t('nav.openProfilePictureEditor')}
            title={t('nav.editProfilePhoto')}
          >
            <Avatar
              email={currentUser.email}
              name={currentUser.name}
              imageUrl={currentUser.imageUrl}
              size="sm"
            />
            <div className="hidden md:block flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-(--text) truncate">{currentUser.name}</p>
              <p className="text-[10px] text-(--muted) truncate">{currentUser.email}</p>
            </div>
          </button>
        </div>
      </div>

      {/* Mobile drawer — rendered as a fixed overlay so it never clips inside a flex ancestor */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            aria-hidden="true"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer panel */}
          <div
            id="mobile-navigation-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={t('nav.navigationMenu')}
            className="lg:hidden fixed left-0 right-0 top-(--header-h) z-50 border-b shadow-xl"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--border-hi)',
            }}
          >
            <nav className="flex flex-col gap-1 px-4 py-4 max-h-[calc(100dvh-var(--header-h))] overflow-y-auto">
              {mobileSectionLinks(primaryLinks)}

              <div className="mt-3 mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-(--muted)">
                {t('nav.tools')}
              </div>
              {mobileSectionLinks(toolsLinks)}

              <div className="mt-3 mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-red-400/80">
                {t('nav.admin')}
              </div>
              {mobileSectionLinks(adminLinks, 'danger')}

              <div className="w-full h-px bg-(--border-hi) my-2" />

              <NavLink
                to="/rewards"
                aria-label={t('nav.rewards')}
                onClick={closeMobileMenu}
                className={({ isActive }) => linkClass(isActive)}
              >
                <span className="opacity-70" aria-hidden="true">
                  <Gift className="w-4 h-4" />
                </span>
                {t('nav.rewards')}
              </NavLink>

              <Link
                to="/help"
                aria-label={t('common.help')}
                title={t('nav.searchDocumentationShortcut', { key: formatShortcutKey('k') })}
                onClick={closeMobileMenu}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition text-(--accent) hover:bg-(--accent)/10"
              >
                <span aria-hidden="true">
                  <HelpCircle className="w-4 h-4" />
                </span>
                {t('common.help')}
              </Link>
            </nav>
          </div>
        </>
      )}

      {isProfileEditorOpen && (
        <div className="fixed inset-0 z-90 grid place-items-center bg-black/65 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-sm rounded-xl border border-(--border-hi) bg-(--surface) p-5 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-(--text)">{t('nav.profilePicture')}</h3>
              <button
                type="button"
                className="rounded p-1 text-(--muted) hover:bg-(--surface-hi)"
                onClick={() => setIsProfileEditorOpen(false)}
                aria-label={t('nav.closeProfilePictureEditor')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <AvatarUpload
              email={currentUser.email}
              name={currentUser.name}
              currentImageUrl={currentUser.imageUrl}
              label={t('nav.uploadProfilePhoto')}
              onImageUpload={(imageUrl) => {
                setUserImageUrl(imageUrl);
                localStorage.setItem('payd:user-avatar', imageUrl);
                setIsProfileEditorOpen(false);
              }}
            />
            <button
              type="button"
              className="mt-4 w-full rounded border border-(--border-hi) px-3 py-2 text-sm text-(--text) hover:bg-(--surface-hi) transition"
              onClick={() => {
                setUserImageUrl(undefined);
                localStorage.removeItem('payd:user-avatar');
              }}
            >
              {t('nav.removeCustomPhoto')}
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default AppNav;
