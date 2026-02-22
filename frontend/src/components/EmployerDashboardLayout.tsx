import React, { useState, useEffect } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { Icon, Card } from "@stellar/design-system";
import { useWallet } from "../providers/WalletProvider";
import { Menu, X, Wallet, Users, FileText, Settings, Home } from "lucide-react";

interface OrganizationData {
  name: string;
  balance: string;
  balanceAsset: string;
}

// Mock organization data - replace with actual API call
const useOrganizationData = (): OrganizationData => {
  const { address } = useWallet();
  const [orgData, setOrgData] = useState<OrganizationData>({
    name: "Acme Corporation",
    balance: "0.00",
    balanceAsset: "XLM",
  });

  useEffect(() => {
    // TODO: Replace with actual API call to fetch organization data
    // For now, using mock data
    if (address) {
      // Simulate fetching balance - in real app, fetch from Stellar Horizon or backend
      setOrgData({
        name: "Acme Corporation",
        balance: "12,450.50",
        balanceAsset: "USDC",
      });
    }
  }, [address]);

  return orgData;
};

const EmployerDashboardLayout: React.FC = () => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const organization = useOrganizationData();

  const navigationItems = [
    { path: "/", label: "Dashboard", icon: Home },
    { path: "/payroll", label: "Payroll", icon: Wallet },
    { path: "/employee", label: "Employees", icon: Users },
    { path: "/reports", label: "Reports", icon: FileText },
    { path: "/settings", label: "Settings", icon: Settings },
  ];

  // Close sidebar when route changes (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-screen bg-[#080b10] text-white overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 bg-[#0d1117] border-r border-white/10
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <NavLink to="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg grid place-items-center font-extrabold text-black text-sm tracking-tight shadow-[0_0_20px_rgba(74,240,184,0.3)] bg-gradient-to-br from-[#4af0b8] to-[#7c6ff7]">
                P
              </div>
              <span className="text-lg font-extrabold tracking-tight">
                Pay<span className="text-[#4af0b8]">D</span>
              </span>
            </NavLink>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-[#8b949e] hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {navigationItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg
                    transition-all duration-200
                    ${
                      isActive
                        ? "bg-white/10 text-[#4af0b8] border border-[#4af0b8]/30"
                        : "text-[#8b949e] hover:bg-white/5 hover:text-white"
                    }
                  `}
                >
                  <IconComponent className="w-5 h-5" />
                  <span className="font-medium text-sm">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-white/10">
            <div className="flex items-center gap-2 text-xs text-[#8b949e]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#4af0b8] shadow-[0_0_6px_#4af0b8]" />
              <span className="font-mono">STELLAR NETWORK</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 bg-[#0d1117]/85 backdrop-blur-[20px] backdrop-saturate-180 border-b border-white/10 flex items-center justify-between px-6">
          {/* Mobile Menu Button */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-[#8b949e] hover:text-white"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Organization Name */}
          <div className="flex-1 flex items-center gap-4">
            <h1 className="text-lg font-bold text-white">
              {organization.name}
            </h1>
          </div>

          {/* Balance Display */}
          <div className="flex items-center gap-4">
            <Card className="bg-white/5 border-white/10 px-4 py-2">
              <div className="flex items-center gap-2">
                <Icon.Wallet className="text-[#4af0b8]" />
                <div className="flex flex-col">
                  <span className="text-xs text-[#8b949e] font-mono">
                    Balance
                  </span>
                  <span className="text-sm font-bold text-white">
                    {organization.balance} {organization.balanceAsset}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </header>

        {/* Content Area with Route Outlet */}
        <main className="flex-1 overflow-y-auto bg-[#080b10]">
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default EmployerDashboardLayout;
