import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Code, User, Wallet, FileText, Globe } from 'lucide-react';
import { Avatar } from './Avatar';
import { useTranslation } from 'react-i18next';

const AppNav: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Mock user data - replace with actual user context
  const currentUser = {
    email: 'user@example.com',
    name: 'John Doe',
    imageUrl: undefined,
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSettingsClick = () => {
    setIsDropdownOpen(false);
    navigate('/settings');
  };

  return (
    <nav className="flex items-center gap-8">
      <NavLink
        to="/payroll"
        className={({ isActive }) =>
          `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition ${
            isActive
              ? 'text-(--accent) bg-white/5'
              : 'text-(--muted) hover:bg-white/10 hover:text-white'
          }`
        }
      >
        <span className="opacity-70">
          <Wallet className="w-4 h-4" />
        </span>
        {t('nav.payroll')}
      </NavLink>

      <NavLink
        to="/employee"
        className={({ isActive }) =>
          `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition ${
            isActive
              ? 'text-(--accent) bg-white/5'
              : 'text-(--muted) hover:bg-white/10 hover:text-white'
          }`
        }
      >
        <span className="opacity-70">
          <User className="w-4 h-4" />
        </span>
        {t('nav.employees')}
      </NavLink>

      <NavLink
        to="/portal"
        className={({ isActive }) =>
          `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition ${
            isActive
              ? 'text-(--accent) bg-white/5'
              : 'text-(--muted) hover:bg-white/10 hover:text-white'
          }`
        }
      >
        <span className="opacity-70">
          <LayoutDashboard className="w-4 h-4" />
        </span>
        My Portal
      </NavLink>

      <NavLink
        to="/reports"
        className={({ isActive }) =>
          `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition ${
            isActive
              ? 'text-(--accent) bg-white/5'
              : 'text-(--muted) hover:bg-white/10 hover:text-white'
          }`
        }
      >
        <span className="opacity-70">
          <FileText className="w-4 h-4" />
        </span>
        Reports
      </NavLink>

      <NavLink
        to="/cross-asset-payment"
        className={({ isActive }) =>
          `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition ${
            isActive
              ? 'text-(--accent) bg-white/5'
              : 'text-(--muted) hover:bg-white/10 hover:text-white'
          }`
        }
      >
        <span className="opacity-70">
          <Globe className="w-4 h-4" />
        </span>
        Cross-Asset
      </NavLink>

      <NavLink
        to="/transactions"
        className={({ isActive }) =>
          `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition ${
            isActive
              ? 'text-(--accent) bg-white/5'
              : 'text-(--muted) hover:bg-white/10 hover:text-white'
          }`
        }
      >
        <span className="opacity-70">
          <Activity className="w-4 h-4" />
        </span>
        History
      </NavLink>

      <div className="w-px h-5 bg-(--border-hi) mx-2" />

      <NavLink
        to="/debug"
        className={({ isActive }) =>
          `flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-mono tracking-wide border transition ${
            isActive
              ? 'text-(--accent2) bg-[rgba(124,111,247,0.06)] border-[rgba(124,111,247,0.25)]'
              : 'text-(--accent2) bg-[rgba(124,111,247,0.06)] border-[rgba(124,111,247,0.25)] hover:bg-[rgba(124,111,247,0.12)]'
          }`
        }
      >
        <Code className="w-4 h-4" />
        {t('nav.debugger')}
      </NavLink>

      <Link to="/help" className="text-blue-500 text-xs underline ml-2">
        Need help?
      </Link>

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className={`flex items-center gap-3 p-1.5 rounded-xl transition-all border outline-none ${
            isDropdownOpen 
              ? 'bg-surface-hi border-border-hi shadow-lg ring-1 ring-accent/20' 
              : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-border'
          }`}
        >
          <Avatar
            email={currentUser.email}
            name={currentUser.name}
            imageUrl={currentUser.imageUrl}
            size="sm"
          />
          <div className="flex flex-col items-start px-1">
            <p className="text-[11px] font-bold text-text leading-tight">{currentUser.name}</p>
            <p className="text-[9px] text-muted leading-tight">{currentUser.email}</p>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-muted transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {isDropdownOpen && (
          <div className="absolute right-0 mt-2 w-48 card glass noise p-1.5 border-border-hi shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="px-2 py-2 border-b border-border/10 mb-1.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted mb-0.5">Organization</p>
              <p className="text-xs font-bold text-text truncate">Stellar Devs Inc.</p>
            </div>
            
            <button
              onClick={handleSettingsClick}
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-xs font-medium text-text hover:bg-accent/10 hover:text-accent transition-colors group"
            >
              <SettingsIcon className="w-3.5 h-3.5 text-muted group-hover:text-accent transition-colors" />
              {t('nav.settings')}
            </button>
            
            <button
              onClick={() => setIsDropdownOpen(false)}
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-xs font-medium text-text hover:bg-red-500/10 hover:text-red-400 transition-colors group"
            >
              <LogOut className="w-3.5 h-3.5 text-muted group-hover:text-red-400 transition-colors" />
              {t('settings.signOut')}
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default AppNav;
