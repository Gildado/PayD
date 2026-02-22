import React, { useState } from "react";

interface EmployeePreference {
    id: string;
    name: string;
    amount: string;
    currency: string;
}

interface SchedulingConfig {
    frequency: "weekly" | "biweekly" | "monthly";
    dayOfWeek?: number; // 0-6 (Sunday-Saturday) for weekly/biweekly
    dayOfMonth?: number; // 1-31 for monthly
    timeOfDay: string; // HH:mm format
    preferences: EmployeePreference[];
}

export const SchedulingWizard = ({
    onComplete,
    onCancel,
}: {
    onComplete: (config: SchedulingConfig) => void;
    onCancel: () => void;
}) => {
    const [step, setStep] = useState(1);
    const [config, setConfig] = useState<SchedulingConfig>({
        frequency: "monthly",
        dayOfMonth: 1,
        timeOfDay: "09:00",
        preferences: [
            { id: "1", name: "Alice", amount: "1000", currency: "USDC" },
            { id: "2", name: "Bob", amount: "1500", currency: "XLM" },
        ], // Mock employees for now
    });

    const handleNext = () => setStep((s: number) => Math.min(s + 1, 3));
    const handleBack = () => setStep((s: number) => Math.max(s - 1, 1));

    const generatePreviewDates = () => {
        const dates = [];
        const now = new Date();
        // Simplified logic for preview demonstration
        for (let i = 1; i <= 3; i++) {
            const d = new Date(now);
            if (config.frequency === 'monthly') {
                d.setMonth(d.getMonth() + i);
                d.setDate(config.dayOfMonth || 1);
            } else if (config.frequency === 'weekly') {
                d.setDate(d.getDate() + (i * 7));
            } else if (config.frequency === 'biweekly') {
                d.setDate(d.getDate() + (i * 14));
            }

            const [hours, minutes] = config.timeOfDay.split(':');
            d.setHours(parseInt(hours), parseInt(minutes), 0, 0);

            // Ensure the date isn't in the past if it's the current period
            dates.push(d);
        }
        return dates;
    };

    return (
        <div className="card glass noise w-full p-6 sm:p-8 flex flex-col gap-6">
            {/* Wizard Header */}
            <div className="flex justify-between items-center border-b border-hi pb-4">
                <h2 className="text-xl font-black">
                    {step === 1 && "Step 1: Set Schedule"}
                    {step === 2 && "Step 2: Currency Preferences"}
                    {step === 3 && "Step 3: Preview & Confirm"}
                </h2>
                <div className="flex gap-2">
                    {[1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className={`h-2 w-8 rounded-full ${step >= i ? "bg-accent" : "bg-surface"
                                }`}
                        />
                    ))}
                </div>
            </div>

            {/* Step 1: Frequency, Day, Time */}
            {step === 1 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-3 ml-1">
                            Frequency
                        </label>
                        <div className="flex gap-4">
                            {["weekly", "biweekly", "monthly"].map((freq) => (
                                <button
                                    key={freq}
                                    type="button"
                                    onClick={() =>
                                        setConfig({ ...config, frequency: freq as any })
                                    }
                                    className={`flex-1 py-3 rounded-xl border font-bold capitalize transition-all ${config.frequency === freq
                                        ? "border-accent text-accent bg-accent/10"
                                        : "border-hi text-muted hover:border-accent/40"
                                        }`}
                                >
                                    {freq}
                                </button>
                            ))}
                        </div>
                    </div>

                    {(config.frequency === "weekly" || config.frequency === "biweekly") && (
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-3 ml-1">
                                Day of Week
                            </label>
                            <select
                                value={config.dayOfWeek || 1}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                                    setConfig({
                                        ...config,
                                        dayOfWeek: parseInt(e.target.value),
                                    })
                                }
                                className="w-full bg-black/20 border border-hi rounded-xl p-4 text-text outline-none focus:border-accent/50 focus:bg-accent/5 transition-all cursor-pointer"
                            >
                                {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, i) => (
                                    <option key={day} value={i} className="bg-surface">{day}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {config.frequency === "monthly" && (
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-3 ml-1">
                                Day of Month
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="31"
                                value={config.dayOfMonth || 1}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    setConfig({
                                        ...config,
                                        dayOfMonth: parseInt(e.target.value),
                                    })
                                }
                                className="w-full bg-black/20 border border-hi rounded-xl p-4 text-text outline-none focus:border-accent/50 focus:bg-accent/5 transition-all font-mono"
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-3 ml-1">
                            Run Time
                        </label>
                        <input
                            type="time"
                            value={config.timeOfDay}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setConfig({ ...config, timeOfDay: e.target.value })
                            }
                            className="w-full bg-black/20 border border-hi rounded-xl p-4 text-text outline-none focus:border-accent/50 focus:bg-accent/5 transition-all font-mono"
                        />
                    </div>
                </div>
            )}

            {/* Step 2: Employee Currency Preferences */}
            {step === 2 && (
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-muted mb-2">
                        Set default currency payout outputs for each employee.
                    </p>
                    <div className="overflow-x-auto border border-hi rounded-xl">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-surface/50 text-xs uppercase text-muted tracking-wider border-b border-hi">
                                <tr>
                                    <th className="px-4 py-3">Employee</th>
                                    <th className="px-4 py-3">Scheduled Amount</th>
                                    <th className="px-4 py-3">Receive In</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-hi">
                                {config.preferences.map((emp, index) => (
                                    <tr key={emp.id} className="bg-black/10 hover:bg-black/20">
                                        <td className="px-4 py-3 font-medium">{emp.name}</td>
                                        <td className="px-4 py-3 font-mono text-muted">${emp.amount}</td>
                                        <td className="px-4 py-3">
                                            <select
                                                value={emp.currency}
                                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                                                    const newPrefs = [...config.preferences];
                                                    newPrefs[index].currency = e.target.value;
                                                    setConfig({ ...config, preferences: newPrefs });
                                                }}
                                                className="bg-transparent border border-hi rounded p-1 text-text focus:border-accent outline-none"
                                            >
                                                <option value="USDC">USDC (Stellar)</option>
                                                <option value="XLM">XLM</option>
                                                <option value="EURC">EURC</option>
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Step 3: Preview */}
            {step === 3 && (
                <div className="flex flex-col gap-6">
                    <div className="bg-accent/10 border border-accent/20 rounded-xl p-6">
                        <h3 className="text-accent font-bold mb-4 flex items-center gap-2">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                            Schedule Overview
                        </h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-muted block text-xs uppercase tracking-wider">Frequency</span>
                                <span className="font-bold capitalize">{config.frequency}</span>
                            </div>
                            <div>
                                <span className="text-muted block text-xs uppercase tracking-wider">Time</span>
                                <span className="font-mono">{config.timeOfDay}</span>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-sm font-bold uppercase tracking-widest text-muted mb-3">Upcoming Runs</h4>
                        <ul className="flex flex-col gap-3">
                            {generatePreviewDates().map((date, i) => (
                                <li key={i} className="flex items-center gap-4 bg-black/20 border border-hi p-4 rounded-xl">
                                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-surface flex items-center justify-center font-bold text-muted text-xs">{i + 1}</span>
                                    <span className="font-mono">{date.toLocaleString()}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            {/* Wizard Footer (Navigation) */}
            <div className="flex justify-between items-center mt-4 border-t border-hi pt-6">
                <button
                    className={`py-2 px-6 rounded-lg font-bold text-sm tracking-wide transition-colors ${step === 1 ? 'text-muted hover:text-text' : 'bg-surface hover:bg-hi/50 text-text'}`}
                    onClick={step === 1 ? onCancel : handleBack}
                >
                    {step === 1 ? "Cancel" : "Back"}
                </button>

                {step < 3 ? (
                    <button
                        className="py-2 px-6 rounded-lg bg-accent text-bg font-bold text-sm tracking-wide hover:brightness-110 shadow-lg shadow-accent/20 transition-all"
                        onClick={handleNext}
                    >
                        Continue
                    </button>
                ) : (
                    <button
                        className="py-2 px-6 rounded-lg bg-success text-bg font-bold text-sm tracking-wide hover:brightness-110 shadow-lg shadow-success/20 transition-all flex items-center gap-2"
                        onClick={() => onComplete(config)}
                    >
                        Confirm Schedule
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </button>
                )}
            </div>
        </div>
    );
};
