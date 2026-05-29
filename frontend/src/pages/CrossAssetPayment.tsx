import { useEffect, useMemo, useState } from 'react';
import { Loader2, ArrowRightLeft, ShieldCheck, Info, CheckCircle2, Radio } from 'lucide-react';
import { Link } from 'react-router-dom';
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
import { ContractErrorPanel } from '../components/ContractErrorPanel';
import { IssuerMultisigBanner } from '../components/IssuerMultisigBanner';
import { parseContractError, type ContractErrorDetail } from '../utils/contractErrorParser';

export default function CrossAssetPayment() {
  const { notifyError, notifyPaymentSuccess, notifyPaymentFailure, notifyApiError } =
    useNotification();
  const { socket } = useSocket();
  const { address, connect, requireWallet } = useWallet();
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
  const [contractError, setContractError] = useState<ContractErrorDetail | null>(null);

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
          notifyApiError(
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
  }, [amount, assetIn, assetOut, notifyError, notifyApiError]);

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
        notifyPaymentSuccess(txHash, 'Cross-asset payment completed');
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
  }, [notifyPaymentSuccess, socket, submissionTxHash]);

  const handleInitiate = async () => {
    const walletAddress = await requireWallet();
    if (!walletAddress) {
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
    setContractError(null);
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
        sourceAddress: walletAddress,
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
      notifyPaymentSuccess(result.txHash, 'Payment submitted');
    } catch (error) {
      setStatus('error');
      const parsed = parseContractError(
        undefined,
        error instanceof Error ? error.message : 'An unexpected error occurred.'
      );
      setContractError(parsed);
      notifyPaymentFailure(parsed.message, submissionTxHash ?? undefined);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="grid gap-6 rounded-[2rem] border border-zinc-800 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.14),transparent_32%),linear-gradient(180deg,rgba(16,16,18,0.96),rgba(10,10,12,0.96))] p-6 shadow-2xl shadow-black/30 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)] lg:p-8">
          <div className="space-y-5">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-300">
              Cross-asset settlement
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                Cross-Asset Payment Settlement
              </h1>
              <p className="mt-3 flex flex-wrap items-center gap-2 text-sm leading-6 text-zinc-400 sm:text-base">
                Live pathfinding, Soroban simulation, and wallet-signed contract submission.
                <Link to="/help?q=anchor" className="text-xs text-blue-400 hover:underline">
                  Learn about anchors
                </Link>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {!address ? (
                <button
                  type="button"
                  onClick={() => {
                    void connect();
                  }}
                  className="rounded-xl bg-accent px-4 py-2.5 font-semibold text-black"
                >
                  Connect Wallet
                </button>
              ) : (
                <span className="rounded-xl border border-zinc-800 bg-black/20 px-4 py-2.5 font-mono text-xs text-zinc-300">
                  {address.slice(0, 6)}...{address.slice(-4)}
                </span>
              )}
              <span className="rounded-xl border border-zinc-800 bg-black/20 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                {status === 'idle' ? 'Ready to simulate' : `Status: ${status}`}
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                Selected route
              </p>
              <p className="mt-2 text-sm font-semibold text-white">
                {selectedPath
                  ? selectedPath.hops.join(' -> ')
                  : 'Choose a path after entering an amount'}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                Settlement signal
              </p>
              <p className="mt-2 text-sm font-semibold text-white">{liveStatusMessage}</p>
            </div>
          </div>
        </header>

        <IssuerMultisigBanner />

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.95fr)]">
          {/* Payment Form */}
          <div className="rounded-[2rem] border border-zinc-800 bg-[#16161a] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Send Asset
                  </label>
                  <select
                    value={assetIn}
                    onChange={(e) => setAssetIn(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-[#0a0a0c] px-4 py-3 outline-none"
                  >
                    <option>USDC</option>
                    <option>XLM</option>
                    <option>EURT</option>
                  </select>
                </div>
                <div className="mt-6">
                  <ArrowRightLeft className="h-6 w-6 text-zinc-600" />
                </div>
                <div className="flex-1">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Receive Asset
                  </label>
                  <select
                    value={assetOut}
                    onChange={(e) => setAssetOut(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-[#0a0a0c] px-4 py-3 outline-none"
                  >
                    <option>NGN</option>
                    <option>BRL</option>
                    <option>ARS</option>
                    <option>KES</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Amount to Send
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-zinc-800 bg-[#0a0a0c] px-4 py-3 text-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-zinc-500">
                    {assetIn}
                  </span>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Receiver Address / ID
                </label>
                <input
                  type="text"
                  value={receiver}
                  onChange={(e) => setReceiver(e.target.value)}
                  placeholder="G... recipient wallet"
                  className="w-full rounded-xl border border-zinc-800 bg-[#0a0a0c] px-4 py-3 outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  void handleInitiate();
                }}
                disabled={status === 'submitting' || status === 'pending' || !selectedPath}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-4 text-lg font-bold transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status === 'submitting' ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  'Simulate + Submit Payment'
                )}
              </button>

              <ContractErrorPanel error={contractError} onClear={() => setContractError(null)} />
            </div>
          </div>

          {/* Right Column: Info & Status */}
          <div className="space-y-8">
            {/* Path Options Panel */}
            {(isLoadingPaths || paths.length > 0) && (
              <div className="animate-in fade-in slide-in-from-bottom-4 rounded-[2rem] border border-zinc-800 bg-gradient-to-br from-zinc-900 to-black p-6 shadow-xl duration-500 sm:p-8">
                <h3 className="mb-6 flex items-center gap-2 text-lg font-bold">
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
                        className={`w-full rounded-xl border px-4 py-3 text-left transition ${selectedPathId === path.id ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-zinc-800 hover:border-zinc-700'}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-sm font-semibold">
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
              <div className="rounded-[2rem] border border-zinc-800 bg-[#16161a] p-6">
                <h4 className="mb-3 font-bold">Settlement Preview</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-zinc-400">
                    <span>Expected Delivery</span>
                    <span className="font-mono text-white">
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
            {status !== 'idle' && (
              <div className="relative overflow-hidden rounded-[2rem] border border-blue-900/30 bg-[#16161a] p-6 shadow-xl sm:p-8">
                <div className="absolute top-0 right-0 p-4">
                  <div
                    className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest ${status === 'completed' || status === 'confirmed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}
                  >
                    {status}
                  </div>
                </div>
                <h3 className="mb-6 text-lg font-bold">Transaction Status</h3>

                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${status !== 'error' ? 'bg-emerald-500' : 'bg-zinc-800'}`}
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
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${status === 'pending' || status === 'completed' || status === 'confirmed' ? 'bg-emerald-500' : 'bg-zinc-800'}`}
                    >
                      {status === 'pending' ? (
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

                  <div className="flex items-center gap-4 opacity-60">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${status === 'completed' || status === 'confirmed' ? 'bg-emerald-500' : 'bg-zinc-800'}`}
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
                  <div className="mt-8 border-t border-zinc-800 pt-6">
                    <p className="mb-2 text-xs font-bold uppercase text-zinc-500">
                      Transaction Hash
                    </p>
                    <p className="break-all font-mono text-xs text-blue-400">{submissionTxHash}</p>
                  </div>
                )}
              </div>
            )}

            {!selectedPath && !isLoadingPaths && (
              <div className="flex gap-4 rounded-[2rem] border border-blue-900/30 bg-blue-900/10 p-6">
                <Info className="shrink-0 text-blue-400" />
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
