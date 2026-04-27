import React, { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
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
} from 'lucide-react';
import { Avatar } from './Avatar';
import { AvatarUpload } from './AvatarUpload';
import { useWallet } from '../hooks/useWallet';

const AppNav: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false);
  const [userImageUrl, setUserImageUrl] = useState<string | undefined>(undefined);
  const { address, walletName, isConnecting, network, setNetwork } = useWallet();
  const closeMobileMenu = () => setMobileOpen(false);

  useEffect(() => {
    const savedImage = localStorage.getItem('payd:user-avatar');
    if (savedImage) {
      setUserImageUrl(savedImage);
    }
  }, []);

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
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isProfileEditorOpen, mobileOpen]);

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

  const navLinks = (
    <>
      <NavLink
        to="/employer"
        aria-label="Employer"
        className={({ isActive }) =>
          `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition ${
            isActive
              ? 'text-(--accent) bg-white/5'
              : 'text-(--muted) hover:bg-white/10 hover:text-white'
          }`
        }
        onClick={closeMobileMenu}
      >
        <span className="opacity-70" aria-hidden="true">
          <Briefcase className="w-4 h-4" />
        </span>
        <span className="hidden sm:inline">Employer</span>
      </NavLink>

      <NavLink
        to="/payroll"
        aria-label="Payroll"
        className={({ isActive }) =>
          `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition ${
            isActive
              ? 'text-(--accent) bg-white/5'
              : 'text-(--muted) hover:bg-white/10 hover:text-white'
          }`
        }
        onClick={closeMobileMenu}
      >
        <span className="opacity-70" aria-hidden="true">
          <Wallet className="w-4 h-4" />
        </span>
        <span className="hidden sm:inline">Payroll</span>
      </NavLink>

      <NavLink
        to="/employee"
        aria-label="Employees"
        className={({ isActive }) =>
          `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition ${
            isActive
              ? 'text-(--accent) bg-white/5'
              : 'text-(--muted) hover:bg-white/10 hover:text-white'
          }`
        }
        onClick={closeMobileMenu}
      >
        <span className="opacity-70" aria-hidden="true">
          <User className="w-4 h-4" />
        </span>
        <span className="hidden sm:inline">Employees</span>
      </NavLink>

      <NavLink
        to="/portal"
        aria-label="My Portal"
        className={({ isActive }) =>
          `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition ${
            isActive
              ? 'text-(--accent) bg-white/5'
              : 'text-(--muted) hover:bg-white/10 hover:text-white'
          }`
        }
        onClick={closeMobileMenu}
      >
        <span className="opacity-70" aria-hidden="true">
          <LayoutDashboard className="w-4 h-4" />
        </span>
        My Portal
      </NavLink>

      <NavLink
        to="/reports"
        aria-label="Reports"
        className={({ isActive }) =>
          `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition ${
            isActive
              ? 'text-(--accent) bg-white/5'
              : 'text-(--muted) hover:bg-white/10 hover:text-white'
          }`
        }
        onClick={closeMobileMenu}
      >
        <span className="opacity-70" aria-hidden="true">
          <FileText className="w-4 h-4" />
        </span>
        <span className="hidden sm:inline">Reports</span>
      </NavLink>

      <NavLink
        to="/cross-asset-payment"
        aria-label="Cross-Asset"
        className={({ isActive }) =>
          `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition ${
            isActive
              ? 'text-(--accent) bg-white/5'
              : 'text-(--muted) hover:bg-white/10 hover:text-white'
          }`
        }
        onClick={closeMobileMenu}
      >
        <span className="opacity-70" aria-hidden="true">
          <Globe className="w-4 h-4" />
        </span>
        <span className="hidden sm:inline">Cross-Asset</span>
      </NavLink>

      <NavLink
        to="/transactions"
        aria-label="History"
        className={({ isActive }) =>
          `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition ${
            isActive
              ? 'text-(--accent) bg-white/5'
              : 'text-(--muted) hover:bg-white/10 hover:text-white'
          }`
        }
        onClick={closeMobileMenu}
      >
        <span className="opacity-70" aria-hidden="true">
          <Activity className="w-4 h-4" />
        </span>
        History
      </NavLink>

      <NavLink
        to="/revenue-split"
        aria-label="Revenue Split"
        className={({ isActive }) =>
          `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition ${
            isActive
              ? 'text-(--accent) bg-white/5'
              : 'text-(--muted) hover:bg-white/10 hover:text-white'
          }`
        }
        onClick={closeMobileMenu}
      >
        <span className="opacity-70" aria-hidden="true">
          <PieChart className="w-4 h-4" />
        </span>
        <span className="hidden sm:inline">Revenue Split</span>
      </NavLink>

      <div className="hidden lg:block w-px h-5 bg-(--border-hi) mx-2" />
      <NavLink
        to="/admin"
        aria-label="Admin"
        className={({ isActive }) =>
          `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition ${
            isActive
              ? 'text-red-500 bg-red-500/10'
              : 'text-red-400 hover:bg-red-500/20 hover:text-red-500'
          }`
        }
        onClick={closeMobileMenu}
      >
        <ShieldAlert className="w-4 h-4" />
        Admin
      </NavLink>

      <NavLink
        to="/debug"
        aria-label="Debugger"
        className={({ isActive }) =>
          `flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-mono tracking-wide border transition ${
            isActive
              ? 'text-(--accent2) bg-[rgba(124,111,247,0.06)] border-[rgba(124,111,247,0.25)]'
              : 'text-(--accent2) bg-[rgba(124,111,247,0.06)] border-[rgba(124,111,247,0.25)] hover:bg-[rgba(124,111,247,0.12)]'
          }`
        }
        onClick={closeMobileMenu}
      >
        <Code className="w-4 h-4" />
        <span className="hidden sm:inline">debugger</span>
      </NavLink>

      <NavLink
        to="/rewards"
        aria-label="Rewards"
        onClick={closeMobileMenu}
        className={({ isActive }) =>
          `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition ${
            isActive
              ? 'text-(--accent) bg-white/5'
              : 'text-(--muted) hover:bg-white/10 hover:text-white'
          }`
        }
      >
        Rewards
      </NavLink>

      <Link
        to="/help"
        aria-label="Help"
        onClick={closeMobileMenu}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition text-(--accent) hover:bg-(--accent)/10"
      >
        Help
      </Link>
    </>
  );

  return (
    <nav className="relative w-full" aria-label="Primary navigation">
      <div className="flex items-center justify-between gap-4 px-3 py-2">
        {/* Desktop links */}
        <div className="hidden lg:flex items-center gap-4">{navLinks}</div>

        {/* Mobile menu button */}
        <button
          type="button"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          aria-controls="mobile-navigation-drawer"
          aria-haspopup="dialog"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="lg:hidden p-2 rounded-md hover:bg-white/5 transition"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* User profile */}
        <div className="ml-auto flex items-center gap-2">
          {/* Network Switcher */}
          <div className="hidden md:flex items-center rounded-lg border border-(--border-hi) bg-(--surface) p-1">
            <button
              title="Switch to Testnet"
              onClick={() => setNetwork('TESTNET')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition ${network === 'TESTNET' ? 'bg-(--accent)/20 text-(--accent)' : 'text-(--muted) hover:text-(--text)'}`}
            >
              Testnet
            </button>
            <button
              title="Switch to Mainnet"
              onClick={() => setNetwork('PUBLIC')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition ${network === 'PUBLIC' ? 'bg-success/20 text-success' : 'text-(--muted) hover:text-(--text)'}`}
            >
              Mainnet
            </button>
          </div>

          <div className="hidden xl:flex flex-col items-end rounded-lg border border-(--border-hi) bg-(--surface) px-3 py-1.5">
            <span className="text-[9px] uppercase tracking-wider text-(--muted)">
              {isConnecting
                ? 'Connecting wallet'
                : walletName
                  ? `${walletName} connected`
                  : 'Wallet'}
            </span>
            <span className="text-[11px] font-mono text-(--accent)">
              {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected'}
            </span>
          </div>
          <button
            type="button"
            className="p-1 rounded-lg flex items-center gap-2 cursor-pointer border border-(--border-hi) bg-(--surface) hover:bg-(--surface-hi) transition"
            onClick={() => setIsProfileEditorOpen(true)}
            aria-label="Open profile picture editor"
            title="Edit profile photo"
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
            aria-label="Navigation menu"
            className="lg:hidden fixed left-0 right-0 top-(--header-h) z-50 border-b shadow-xl"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--border-hi)',
            }}
          >
            <nav className="flex flex-col gap-1 px-4 py-4 max-h-[calc(100dvh-var(--header-h))] overflow-y-auto">
              {navLinks}
            </nav>
          </div>
        </>
      )}

      {isProfileEditorOpen && (
        <div className="fixed inset-0 z-90 grid place-items-center bg-black/65 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-sm rounded-xl border border-(--border-hi) bg-(--surface) p-5 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-(--text)">Profile Picture</h3>
              <button
                type="button"
                className="rounded p-1 text-(--muted) hover:bg-(--surface-hi)"
                onClick={() => setIsProfileEditorOpen(false)}
                aria-label="Close profile picture editor"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <AvatarUpload
              email={currentUser.email}
              name={currentUser.name}
              currentImageUrl={currentUser.imageUrl}
              label="Upload Profile Photo"
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
              Remove Custom Photo
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default AppNav;
