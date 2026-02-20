import { Icon } from "@stellar/design-system";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-6 py-12">
      <div className="mb-10 p-8 glass glow-mint rounded-full relative">
        <Icon.Rocket01 size="xl" className="text-accent relative z-20" />
        <div className="absolute inset-0 bg-accent opacity-5 blur-2xl rounded-full" />
      </div>

      <h1 className="text-6xl font-black mb-6 tracking-tighter leading-none">
        Automate your <span className="text-accent">Payroll</span> <br />
        on the <span className="text-accent2">Stellar</span> Network.
      </h1>

      <p className="text-xl text-muted max-w-2xl mb-12 leading-relaxed font-medium">
        PayD is the next-gen dashboard for real-time employee payments.
        Secure, transparent, and ultra-fast.
      </p>

      <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6">
        <button
          className="px-8 py-4 bg-accent text-bg font-bold rounded-xl hover:scale-105 transition-transform shadow-lg shadow-accent/20"
          onClick={() => {
            void navigate("/payroll");
          }}
        >
          Manage Payroll
        </button>
        <button
          className="px-8 py-4 glass border-hi text-text font-bold rounded-xl hover:bg-white/5 transition-all outline-none"
          onClick={() => {
            void navigate("/employee");
          }}
        >
          View Employees
        </button>
      </div>

      <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 text-left max-w-6xl w-full">
        <div className="card glass noise">
          <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-6 border border-accent/20">
            <Icon.CreditCard01 size="lg" className="text-accent" />
          </div>
          <h3 className="text-xl font-bold mb-3">Instant Settlement</h3>
          <p className="text-muted text-sm leading-relaxed">No more waiting for banks. Pay your staff in seconds with sub-cent fees.</p>
        </div>

        <div className="card glass noise">
          <div className="w-12 h-12 rounded-lg bg-accent2/10 flex items-center justify-center mb-6 border border-accent2/20">
            <Icon.Users01 size="lg" className="text-accent2" />
          </div>
          <h3 className="text-xl font-bold mb-3">Global Workforce</h3>
          <p className="text-muted text-sm leading-relaxed">Onboard anyone, anywhere. Pay in USDC, XLM, or local stablecoins.</p>
        </div>

        <div className="card glass noise">
          <div className="w-12 h-12 rounded-lg bg-danger/10 flex items-center justify-center mb-6 border border-danger/20">
            <Icon.ShieldTick size="lg" className="text-danger" />
          </div>
          <h3 className="text-xl font-bold mb-3">On-Chain Audit</h3>
          <p className="text-muted text-sm leading-relaxed">Full transparency. Every transaction is immutable and verifiable on-ledger.</p>
        </div>
      </div>
    </div>
  );
}
