import { Icon } from "@stellar/design-system";
import { Link } from "react-router-dom";

type ErrorFallbackProps = {
    title?: string;
    description?: string;
    onReset?: () => void;
};

export default function ErrorFallback({ title, description, onReset }: ErrorFallbackProps) {
    return (
        <div className="flex-1 flex items-center justify-center p-8">
            <div className="card glass noise max-w-md w-full text-center">
                <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 border border-danger/20">
                    <Icon.AlertTriangle size="lg" className="text-danger" />
                </div>
                <h2 className="text-2xl font-bold mb-2">
                    {title || "Something went wrong"}
                </h2>
                <p className="text-muted text-sm mb-6">
                    {description || "The interface hit an unexpected error. The issue has been logged for review."}
                </p>
                <div className="flex items-center justify-center gap-3">
                    {onReset && (
                        <button
                            type="button"
                            onClick={onReset}
                            className="px-4 py-2 rounded-lg bg-accent text-bg font-semibold text-sm hover:scale-105 transition-transform"
                        >
                            Try again
                        </button>
                    )}
                    <Link
                        to="/"
                        className="px-4 py-2 rounded-lg border border-hi text-sm font-medium text-text hover:bg-white/5 transition-colors"
                    >
                        Go back home
                    </Link>
                </div>
            </div>
        </div>
    );
}

