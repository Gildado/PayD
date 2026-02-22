import { useState, useEffect } from "react";

export const CountdownTimer = ({ targetDate }: { targetDate: Date | null }) => {
    const [timeLeft, setTimeLeft] = useState({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
    });

    // initializer

    useEffect(() => {
        if (!targetDate) return;

        const interval = setInterval(() => {
            const now = new Date().getTime();
            const distance = targetDate.getTime() - now;

            if (distance < 0) {
                clearInterval(interval);
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
                return;
            }

            setTimeLeft({
                days: Math.floor(distance / (1000 * 60 * 60 * 24)),
                hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
                seconds: Math.floor((distance % (1000 * 60)) / 1000),
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [targetDate]);

    if (!targetDate) return null;

    return (
        <div className="flex items-center gap-4">
            <div className="flex flex-col items-center">
                <span className="text-2xl font-mono font-black text-accent">{timeLeft.days}</span>
                <span className="text-[10px] uppercase tracking-widest text-muted">Days</span>
            </div>
            <span className="text-muted font-bold -mt-4">:</span>
            <div className="flex flex-col items-center">
                <span className="text-2xl font-mono font-black text-accent">{timeLeft.hours.toString().padStart(2, '0')}</span>
                <span className="text-[10px] uppercase tracking-widest text-muted">Hrs</span>
            </div>
            <span className="text-muted font-bold -mt-4">:</span>
            <div className="flex flex-col items-center">
                <span className="text-2xl font-mono font-black text-accent">{timeLeft.minutes.toString().padStart(2, '0')}</span>
                <span className="text-[10px] uppercase tracking-widest text-muted">Min</span>
            </div>
            <span className="text-muted font-bold -mt-4">:</span>
            <div className="flex flex-col items-center">
                <span className="text-2xl font-mono font-black text-accent">{timeLeft.seconds.toString().padStart(2, '0')}</span>
                <span className="text-[10px] uppercase tracking-widest text-muted">Sec</span>
            </div>
        </div>
    );
};
