import { useTranslation } from "react-i18next";

interface AutosaveIndicatorProps {
    saving: boolean;
    lastSaved: Date | null;
}

export const AutosaveIndicator = ({ saving, lastSaved }: AutosaveIndicatorProps) => {
    const { t } = useTranslation();

    if (saving) {
        return (
            <div className="flex items-center text-sm text-gray-500 font-medium">
                <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                    />
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                </svg>
                <span className="uppercase tracking-widest">{t("autosave.saving")}</span>
            </div>
        );
    }

    if (lastSaved) {
        const time = lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

        return (
            <div className="flex items-center gap-2 text-[10px] font-mono text-muted">
                <div className="w-1.5 h-1.5 rounded-full bg-success/40" style={{ background: "var(--success)" }} />
                <span className="uppercase tracking-wider">
                    {t("autosave.saved")} {time}
                </span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 text-[10px] font-mono text-muted">
            <div className="w-1.5 h-1.5 rounded-full bg-muted/40" />
            <span className="uppercase tracking-wider">{t("autosave.neverSaved")}</span>
        </div>
    );
};
