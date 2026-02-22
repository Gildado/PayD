import React, { useState, useEffect } from "react";
import { anchorService } from "../services/anchor";
import { Loader2, ArrowRightLeft, ShieldCheck, Info, CheckCircle2 } from "lucide-react";

export default function CrossAssetPayment() {
    const [domain, setDomain] = useState("testanchor.stellar.org");
    const [assetIn, setAssetIn] = useState("USDC");
    const [assetOut, setAssetOut] = useState("NGN");
    const [amount, setAmount] = useState("");
    const [receiver, setReceiver] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [quote, setQuote] = useState<any>(null);
    const [transaction, setTransaction] = useState<any>(null);
    const [status, setStatus] = useState<string>("idle");

    const fetchQuote = async () => {
        if (!amount || Number(amount) <= 0) return;
        setIsLoading(true);
        try {
            // Simulation of quote fetching from anchor
            setTimeout(() => {
                setQuote({
                    rate: 1550.25,
                    fee: 2.50,
                    total_out: (Number(amount) * 1550.25) - 2.50
                });
                setIsLoading(false);
            }, 1000);
        } catch (error) {
            console.error(error);
            setIsLoading(false);
        }
    };

    const handleInitiate = async () => {
        setStatus("initiating");
        try {
            // In a real app, we'd get the secretKey from a secure store or wallet integration
            // For this demo/task, we use a placeholder logic
            const result = await anchorService.initiatePayment(domain, "S...MOCKED", {
                amount,
                asset_code: assetOut,
                receiver_id: receiver
            });
            setTransaction(result);
            setStatus("pending");

            // Start polling for status
            const interval = setInterval(async () => {
                const statusUpdate = await anchorService.getTransactionStatus(domain, result.id, "S...MOCKED");
                setTransaction(statusUpdate);
                if (statusUpdate.status === "completed") {
                    setStatus("completed");
                    clearInterval(interval);
                }
            }, 3000);

        } catch (error) {
            setStatus("error");
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0c] text-white p-8 font-sans">
            <div className="max-w-4xl mx-auto">
                <header className="mb-12">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                        SEP-31 Cross-Asset Payments
                    </h1>
                    <p className="text-zinc-400 mt-2">Send local assets, receive global value. Powered by Stellar Anchors.</p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Payment Form */}
                    <div className="bg-[#16161a] border border-zinc-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Anchor Domain</label>
                                <input
                                    type="text"
                                    value={domain}
                                    onChange={(e) => setDomain(e.target.value)}
                                    className="w-full bg-[#0a0a0c] border border-zinc-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="flex-1">
                                    <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Send Asset</label>
                                    <select
                                        value={assetIn}
                                        onChange={(e) => setAssetIn(e.target.value)}
                                        className="w-full bg-[#0a0a0c] border border-zinc-800 rounded-xl px-4 py-3 outline-none"
                                    >
                                        <option>USDC</option>
                                        <option>XLM</option>
                                        <option>EURT</option>
                                    </select>
                                </div>
                                <div className="mt-6">
                                    <ArrowRightLeft className="text-zinc-600 h-6 w-6" />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Receive Asset</label>
                                    <select
                                        value={assetOut}
                                        onChange={(e) => setAssetOut(e.target.value)}
                                        className="w-full bg-[#0a0a0c] border border-zinc-800 rounded-xl px-4 py-3 outline-none"
                                    >
                                        <option>NGN</option>
                                        <option>BRL</option>
                                        <option>ARS</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Amount to Send</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        onBlur={fetchQuote}
                                        placeholder="0.00"
                                        className="w-full bg-[#0a0a0c] border border-zinc-800 rounded-xl px-4 py-3 text-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">{assetIn}</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Receiver Address / ID</label>
                                <input
                                    type="text"
                                    value={receiver}
                                    onChange={(e) => setReceiver(e.target.value)}
                                    placeholder="G... or local ID"
                                    className="w-full bg-[#0a0a0c] border border-zinc-800 rounded-xl px-4 py-3 outline-none"
                                />
                            </div>

                            <button
                                onClick={handleInitiate}
                                disabled={status !== "idle" || !quote}
                                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 py-4 rounded-xl font-bold text-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {status === "initiating" ? <Loader2 className="animate-spin" /> : "Initiate Payment"}
                            </button>
                        </div>
                    </div>

                    {/* Right Column: Info & Status */}
                    <div className="space-y-8">
                        {/* Quote Panel */}
                        {quote && (
                            <div className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 rounded-2xl p-8 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <h3 className="text-lg font-bold flex items-center gap-2 mb-6">
                                    <ShieldCheck className="text-emerald-400" />
                                    Live Conversion Rate
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between text-zinc-400">
                                        <span>Rate</span>
                                        <span className="text-white font-mono">1 {assetIn} = {quote.rate} {assetOut}</span>
                                    </div>
                                    <div className="flex justify-between text-zinc-400">
                                        <span>Anchor Fee</span>
                                        <span className="text-white font-mono">{quote.fee} {assetOut}</span>
                                    </div>
                                    <div className="pt-4 border-t border-zinc-800 flex justify-between">
                                        <span className="text-zinc-400 font-bold">Receiver Gets</span>
                                        <span className="text-2xl font-bold text-emerald-400 font-mono">
                                            {quote.total_out.toLocaleString()} {assetOut}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Status Panel */}
                        {status !== "idle" && (
                            <div className="bg-[#16161a] border border-blue-900/30 rounded-2xl p-8 shadow-xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4">
                                    <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                        {status}
                                    </div>
                                </div>
                                <h3 className="text-lg font-bold mb-6">Transaction Status</h3>

                                <div className="space-y-6">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${status !== 'error' ? 'bg-emerald-500' : 'bg-zinc-800'}`}>
                                            <CheckCircle2 className="h-5 w-5 text-white" />
                                        </div>
                                        <div>
                                            <p className="font-bold">Authentication</p>
                                            <p className="text-xs text-zinc-500">SEP-10 WebAuth Success</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${status === 'pending' || status === 'completed' ? 'bg-emerald-500' : 'bg-zinc-800'}`}>
                                            {status === 'pending' ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5 text-white" />}
                                        </div>
                                        <div>
                                            <p className="font-bold">Initiation</p>
                                            <p className="text-xs text-zinc-500">SEP-31 Transaction Registered</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 opacity-50">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${status === 'completed' ? 'bg-emerald-500' : 'bg-zinc-800'}`}>
                                            <CheckCircle2 className="h-5 w-5 text-white" />
                                        </div>
                                        <div>
                                            <p className="font-bold">Settlement</p>
                                            <p className="text-xs text-zinc-500">Funds Converted & Sent</p>
                                        </div>
                                    </div>
                                </div>

                                {transaction && (
                                    <div className="mt-8 pt-6 border-t border-zinc-800">
                                        <p className="text-xs text-zinc-500 uppercase font-bold mb-2">Transaction ID</p>
                                        <p className="text-xs font-mono break-all text-blue-400">{transaction.id}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {!quote && !isLoading && (
                            <div className="bg-blue-900/10 border border-blue-900/30 rounded-2xl p-6 flex gap-4">
                                <Info className="text-blue-400 shrink-0" />
                                <p className="text-sm text-blue-300">
                                    Enter an amount to see live conversion rates and anchor fees for this route.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
