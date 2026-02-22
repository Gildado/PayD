import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function Debugger() {
  const { contractName } = useParams<{ contractName?: string }>();
  const { t } = useTranslation();

  return (
    <div className="flex-1 flex flex-col items-center justify-start p-12 max-w-6xl mx-auto w-full">
      <div className="w-full mb-12 flex items-end justify-between border-b border-hi pb-8">
        <div>
          <h1 className="text-4xl font-black mb-2 tracking-tight">
            {t("debugger.title", { highlight: "" }).replace(
              "{{highlight}}",
              "",
            )}
            <span className="text-accent2">
              {" "}
              {t("debugger.titleHighlight")}
            </span>
          </h1>
          <p className="text-muted font-mono text-sm tracking-wider uppercase">
            {t("debugger.subtitle")}
          </p>
        </div>
        {contractName && (
          <div className="px-4 py-2 glass border-hi text-accent2 font-mono text-xs rounded-lg">
            {t("debugger.target", { contractName })}
          </div>
        )}
      </div>

      <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="card glass noise h-fit">
            <h3 className="text-lg font-bold mb-4">
              {t("debugger.networkStatusTitle")}
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted text-xs uppercase font-bold tracking-widest">
                  {t("debugger.protocol")}
                </span>
                <span className="text-text font-mono text-sm">v21</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted text-xs uppercase font-bold tracking-widest">
                  {t("debugger.horizon")}
                </span>
                <span className="text-success font-mono text-sm">
                  {t("debugger.horizonOnline")}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted text-xs uppercase font-bold tracking-widest">
                  {t("debugger.latency")}
                </span>
                <span className="text-text font-mono text-sm">
                  {t("debugger.latencyValue")}
                </span>
              </div>
            </div>
          </div>

          <div className="card glass noise h-fit">
            <h3 className="text-lg font-bold mb-4">
              {t("debugger.availableToolsTitle")}
            </h3>
            <div className="flex flex-col gap-2">
              <button className="text-left p-3 rounded-lg hover:bg-white/5 transition-all text-sm font-medium border border-transparent hover:border-border-hi">
                {t("debugger.toolXdrInspector")}
              </button>
              <button className="text-left p-3 rounded-lg hover:bg-white/5 transition-all text-sm font-medium border border-transparent hover:border-border-hi">
                {t("debugger.toolAuthSimulator")}
              </button>
              <button className="text-left p-3 rounded-lg hover:bg-white/5 transition-all text-sm font-medium border border-transparent hover:border-border-hi">
                {t("debugger.toolEventStream")}
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="card glass noise min-h-100 flex flex-col items-center justify-center text-center p-12">
            <div className="w-16 h-16 rounded-2xl bg-accent2/10 flex items-center justify-center mb-6 border border-accent2/20">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-accent2"
              >
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-3">
              {t("debugger.noActiveTraceTitle")}
            </h2>
            <p className="text-muted max-w-md">
              {t("debugger.noActiveTraceBody")}
            </p>
            <button className="mt-8 px-6 py-3 bg-accent2 text-bg font-bold rounded-xl hover:scale-105 transition-transform">
              {t("debugger.connectContract")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
