import { useEffect, useMemo, useState } from 'react';
import { Loader2, ArrowRightLeft, ShieldCheck, Info, CheckCircle2, Radio } from 'lucide-react';
import { useNotification } from '../hooks/useNotification';
import { useSocket } from '../hooks/useSocket';
import { useWallet } from '../hooks/useWallet';
import { useWalletSigning } from '../hooks/useWalletSigning';
import { contractService } from '../services/contracts';
import {
  fetchConversionPaths,
  submitCrossAssetPayment,
  type ConversionPath,
} from '../services/crossAssetPayment';

export default function CrossAssetPayment() {
  const { notifySuccess, notifyError } = useNotification();
  const { socket } = useSocket();
  const { address, connect } = useWallet();
  const { sign } = useWalletSigning();
  const [assetIn, setAssetIn] = useState('USDC');
  const [assetOut, setAssetOut] = useState('NGN');
  const [amount, setAmount] = useState('');
  const [receiver, setReceiver] = useState('');
  const [paths, setPaths] = useState<ConversionPath[]>([]);
  const [selectedPathId, setSelectedPathId] = useState<string>('');
  const [isLoadingPaths, setIsLoadingPaths] = useState(false);
  const [submissionTxHash, setSubmissionTxHash] = useState<string | null>(null);
  const [liveStatusMessage, setLiveStatusMessage] = useState<string>('Waiting for submission...');
  const [status, setStatus] = useState<string>('idle');

  const selectedPath = useMemo(
    () => paths.find((path) => path.id === selectedPathId) || null,
    [paths, selectedPathId]
  );

  useEffect(() => {
    const parsedAmount = Number.parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setPaths([]);
      setSelectedPathId('');
      return;
    }

    setIsLoadingPaths(true);
    const timeout = setTimeout(() => {
      void (async () => {
        try {
          const nextPaths = await fetchConversionPaths({
            fromAsset: assetIn,
            toAsset: assetOut,
            amount: parsedAmount,
          });
          setPaths(nextPaths);
          setSelectedPathId((current) => current || nextPaths[0]?.id || '');
        } catch (error) {
          notifyError(
            'Pathfinding failed',
            error instanceof Error ? error.message : 'Failed to fetch conversion paths.'
          );
        } finally {
          setIsLoadingPaths(false);
        }
      })();
    }, 450);

    return () => {
      clearTimeout(timeout);
      setIsLoadingPaths(false);
    };
  }, [amount, assetIn, assetOut, notifyError]);

  useEffect(() => {
    if (!socket || !submissionTxHash) return;

    const handler = (payload: unknown) => {
      if (!payload || typeof payload !== 'object') return;
      const record = payload as Record<string, unknown>;
      const txHash = (record.txHash as string | undefined) || (record.hash as string | undefined);
      if (!txHash || txHash !== submissionTxHash) return;

      const nextStatus =
        (record.status as string | undefined) ||
        (record.state as string | undefined) ||
        'processing';
      setStatus(nextStatus);
      setLiveStatusMessage(`Live update: ${nextStatus}`);
      if (nextStatus === 'completed' || nextStatus === 'confirmed') {
        notifySuccess('Cross-asset payment completed', `Transaction ${txHash} settled.`);
      }
    };

    socket.on('cross-asset:update', handler);
    socket.on('transaction:update', handler);
    socket.emit('subscribe:transaction', submissionTxHash);

    return () => {
      socket.off('cross-asset:update', handler);
      socket.off('transaction:update', handler);
      socket.emit('unsubscribe:transaction', submissionTxHash);
    };
  }, [notifySuccess, socket, submissionTxHash]);

  const handleInitiate = async () => {
    if (!address) {
      notifyError('Wallet required', 'Connect your wallet before submitting cross-asset payment.');
      return;
    }
    if (!selectedPath) {
      notifyError('No path selected', 'Select a conversion path before submitting.');
      return;
    }

    const parsedAmount = Number.parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      notifyError('Invalid amount', 'Enter a valid payment amount.');
      return;
    }

    setStatus('submitting');
    try {
      await contractService.initialize();
      const contractId =
        contractService.getContractId('cross_asset_payment', 'testnet') ||
        (import.meta.env.VITE_CROSS_ASSET_PAYMENT_CONTRACT_ID as string | undefined);
      if (!contractId) {
        throw new Error('Cross-asset contract ID is unavailable.');
      }

      const result = await submitCrossAssetPayment({
        contractId,
        sourceAddress: address,
        signTransaction: sign,
        amount: parsedAmount,
        fromAsset: assetIn,
        toAsset: assetOut,
        receiver,
        selectedPathId: selectedPath.id,
      });

      setSubmissionTxHash(result.txHash);
      setStatus('pending');
      setLiveStatusMessage('Submitted. Waiting for live settlement updates...');
      notifySuccess('Payment submitted', `On-chain transaction hash: ${result.txHash}`);
    } catch (error) {
      setStatus('error');
      notifyError(
        'Payment failed',
        error instanceof Error ? error.message : 'An unexpected error occurred.'
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              Cross-Asset Payment Settlement
            </h1>
            <p className="text-zinc-400 mt-2">
              Live pathfinding, Soroban simulation, and wallet-signed contract submission.
            </p>
          </div>
          {!address ? (
            <button
              type="button"
              onClick={() => {
                void connect();
              }}
              className="px-4 py-2 rounded-lg bg-accent text-black font-semibold"
            >
              Connect Wallet
            </button>
          ) : (
            <span className="text-xs text-zinc-400 font-mono">
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
          )}
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Payment Form */}
          <div className="bg-[#16161a] border border-zinc-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                    Send Asset
                  </label>
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
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                    Receive Asset
                  </label>
                  <select
                    value={assetOut}
                    onChange={(e) => setAssetOut(e.target.value)}
                    className="w-full bg-[#0a0a0c] border border-zinc-800 rounded-xl px-4 py-3 outline-none"
                  >
                    <option>NGN</option>
                    <option>BRL</option>
                    <option>ARS</option>
                    <option>KES</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                  Amount to Send
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[#0a0a0c] border border-zinc-800 rounded-xl px-4 py-3 text-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">
                    {assetIn}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                  Receiver Address / ID
                </label>
                <input
                  type="text"
                  value={receiver}
                  onChange={(e) => setReceiver(e.target.value)}
                  placeholder="G... recipient wallet"
                  className="w-full bg-[#0a0a0c] border border-zinc-800 rounded-xl px-4 py-3 outline-none"
                />
              </div>

              <button
                onClick={() => {
                  void handleInitiate();
                }}
                disabled={status === 'submitting' || status === 'pending' || !selectedPath}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 py-4 rounded-xl font-bold text-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {status === 'submitting' ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  'Simulate + Submit Payment'
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Info & Status */}
          <div className="space-y-8">
            {/* Path Options Panel */}
            {(isLoadingPaths || paths.length > 0) && (
              <div className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 rounded-2xl p-8 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-6">
                  <ShieldCheck className="text-emerald-400" />
                  Available Conversion Paths
                </h3>
                {isLoadingPaths ? (
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Fetching conversion paths...
                  </div>
                ) : (
                  <div className="space-y-3">
                    {paths.map((path) => (
                      <button
                        key={path.id}
                        type="button"
                        onClick={() => setSelectedPathId(path.id)}
                        className={`w-full text-left rounded-xl border px-4 py-3 transition ${selectedPathId === path.id ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-zinc-800 hover:border-zinc-700'}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold flex items-center gap-2">
                            <Radio className="h-4 w-4" />
                            {path.hops.join(' -> ')}
                          </span>
                          <span className="text-xs text-zinc-400">{path.rate.toFixed(4)} rate</span>
                        </div>
                        <div className="mt-2 text-xs text-zinc-400">
                          Fee: {path.fee.toFixed(4)} {assetOut} | Slippage:{' '}
                          {path.slippage.toFixed(2)}%
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedPath && (
              <div className="bg-[#16161a] border border-zinc-800 rounded-2xl p-6">
                <h4 className="font-bold mb-3">Settlement Preview</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-zinc-400">
                    <span>Expected Delivery</span>
                    <span className="text-white font-mono">
                      {selectedPath.estimatedDestinationAmount.toLocaleString()} {assetOut}
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Fee</span>
                    <span className="text-white">
                      {selectedPath.fee.toFixed(4)} {assetOut}
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Slippage</span>
                    <span className="text-white">{selectedPath.slippage.toFixed(2)}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Status Panel */}
            {status !== "idle" && (
              <div className="bg-[#16161a] border border-blue-900/30 rounded-2xl p-8 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4">
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${status === 'completed' || status === 'confirmed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}
                  >
                    {status}
                  </div>
                </div>
                <h3 className="text-lg font-bold mb-6">Transaction Status</h3>

                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${status !== "error" ? "bg-emerald-500" : "bg-zinc-800"}`}
                    >
                      <CheckCircle2 className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-bold">Authentication</p>
                      <p className="text-xs text-zinc-500">Wallet connected and signer ready</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${status === 'pending' || status === 'completed' || status === 'confirmed' ? 'bg-emerald-500' : 'bg-zinc-800'}`}
                    >
                      {status === "pending" ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-5 w-5 text-white" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold">Initiation</p>
                      <p className="text-xs text-zinc-500">Contract call simulated and submitted</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 opacity-50">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${status === 'completed' || status === 'confirmed' ? 'bg-emerald-500' : 'bg-zinc-800'}`}
                    >
                      <CheckCircle2 className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-bold">Settlement</p>
                      <p className="text-xs text-zinc-500">{liveStatusMessage}</p>
                    </div>
                  </div>
                </div>

                {submissionTxHash && (
                  <div className="mt-8 pt-6 border-t border-zinc-800">
                    <p className="text-xs text-zinc-500 uppercase font-bold mb-2">
                      Transaction Hash
                    </p>
                    <p className="text-xs font-mono break-all text-blue-400">{submissionTxHash}</p>
                  </div>
                )}
              </div>
            )}

            {!selectedPath && !isLoadingPaths && (
              <div className="bg-blue-900/10 border border-blue-900/30 rounded-2xl p-6 flex gap-4">
                <Info className="text-blue-400 shrink-0" />
                <p className="text-sm text-blue-300">
                  Change asset pair and amount to request path options from backend proxy.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
