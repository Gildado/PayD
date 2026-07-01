import React, { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@stellar/design-system';
import {
  Copy,
  Download,
  Key,
  Eye,
  BookOpen,
  ChevronDown,
  Coins,
  Printer,
  WalletCards,
} from 'lucide-react';
import { useNotification } from '../hooks/useNotification';

interface WalletQRCodeProps {
  walletAddress: string;
  secretKey?: string;
  employeeName?: string;
}

const TRUSTLINE_STEPS = [
  {
    step: 1,
    title: 'Fund Your Wallet',
    description: 'Add XLM to your wallet. You need at least 1 XLM to create a trustline.',
  },
  {
    step: 2,
    title: 'Choose Your Asset',
    description:
      'Decide which asset you want to receive (USDC, EURC, or XLM). Each asset requires a separate trustline.',
  },
  {
    step: 3,
    title: 'Create Trustline',
    description:
      "Navigate to your wallet's asset settings and add a trustline for the chosen asset using its issuer address.",
  },
  {
    step: 4,
    title: 'Verify Trustline',
    description:
      "After creation, verify the trustline appears in your wallet's asset list. You can now receive payments in that asset.",
  },
];

const ASSET_INFO = [
  {
    code: 'USDC',
    issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    network: 'Stellar Mainnet',
  },
  {
    code: 'EURC',
    issuer: 'GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXCWDQWZ4FIT6JGNG',
    network: 'Stellar Mainnet',
  },
  {
    code: 'XLM',
    issuer: 'Native',
    network: 'Stellar Mainnet',
  },
];

export const WalletQRCode: React.FC<WalletQRCodeProps> = ({
  walletAddress,
  secretKey,
  employeeName,
}) => {
  const [showSecret, setShowSecret] = useState(false);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const { notifySuccess } = useNotification();

  const downloadQRCode = () => {
    const svgElement = qrCodeRef.current?.querySelector('svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new window.Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `stellar-wallet-${walletAddress.slice(0, 8)}.png`;
      link.href = pngUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      notifySuccess('QR code downloaded as image');
    };

    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`;
  };

  const printQRCode = () => {
    const svgElement = qrCodeRef.current?.querySelector('svg');
    if (!svgElement) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const svgClone = svgElement.cloneNode(true) as SVGElement;
    svgClone.setAttribute('width', '400');
    svgClone.setAttribute('height', '400');

    printWindow.document.write(`
      <html>
        <head>
          <title>Print Wallet QR Code</title>
          <style>
            body { display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
            .qr-wrapper { text-align: center; }
            .address { font-family: monospace; margin-top: 16px; font-size: 14px; word-break: break-all; max-width: 400px; }
          </style>
        </head>
        <body>
          <div class="qr-wrapper">
            ${svgClone.outerHTML}
            <div class="address">${walletAddress}</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notifySuccess(`${label} copied to clipboard!`);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      notifySuccess(`${label} copied to clipboard!`);
    }
  };

  const truncateAddress = (address: string) => {
    if (address.length <= 16) return address;
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  return (
    <div className="space-y-6">
      <div className="card border-[var(--border-hi)] bg-[var(--surface)]/95 rounded-2xl p-6">
        <h3 className="text-lg font-bold mb-4 text-[var(--text)] flex items-center gap-2">
          <WalletCards className="h-5 w-5 text-[var(--accent)]" aria-hidden />
          Your Stellar Wallet Address
        </h3>

        <div className="flex flex-col md:flex-row gap-6 items-center">
          <div ref={qrCodeRef} className="bg-white p-4 rounded-xl shadow-lg">
            <QRCodeSVG value={walletAddress} size={160} level="H" includeMargin={false} />
          </div>

          <div className="flex-1 space-y-4 w-full">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)] block mb-2">
                Wallet Address
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[var(--text)] bg-[var(--surface-hi)] px-4 py-3 rounded-xl text-sm font-mono break-all border border-[var(--border)]">
                  {walletAddress}
                </code>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="tertiary"
                size="md"
                onClick={() => void copyToClipboard(walletAddress, 'Wallet address')}
                className="w-full sm:w-auto"
              >
                <Copy size={16} className="mr-2" />
                Copy Address
              </Button>
              <Button
                variant="tertiary"
                size="md"
                onClick={downloadQRCode}
                className="w-full sm:w-auto"
              >
                <Download size={16} className="mr-2" />
                Download QR
              </Button>
              <Button
                variant="tertiary"
                size="md"
                onClick={printQRCode}
                className="w-full sm:w-auto"
              >
                <Printer size={16} className="mr-2" />
                Print QR
              </Button>
            </div>

            {secretKey && (
              <div className="mt-4">
                <label className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#f59e0b] flex items-center gap-2 mb-2">
                  <Key size={16} />
                  Secret Key (Save Securely!)
                </label>
                <div className="p-4 bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.22)] rounded-xl">
                  {showSecret ? (
                    <div className="space-y-3">
                      <code className="text-[#f59e0b] text-xs font-mono break-all block">
                        {secretKey}
                      </code>
                      <Button
                        variant="tertiary"
                        size="sm"
                        onClick={() => void copyToClipboard(secretKey, 'Secret key')}
                      >
                        <Copy size={16} className="mr-2" />
                        Copy Secret Key
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowSecret(true)}
                      className="text-[#f59e0b] hover:text-[#d97706] text-sm flex items-center gap-2 font-semibold transition"
                    >
                      <Eye size={16} />
                      Click to reveal secret key
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card border-[var(--border-hi)] bg-[var(--surface)]/95 rounded-2xl p-6">
        <h3 className="text-lg font-bold mb-4 text-[var(--text)] flex items-center gap-2">
          <BookOpen size={20} />
          Trustline Setup Guide
        </h3>
        <p className="text-[var(--muted)] text-sm mb-4">
          To receive payments in different currencies, you need to set up trustlines. Follow these
          steps:
        </p>

        <div className="space-y-3">
          {TRUSTLINE_STEPS.map((item) => (
            <div
              key={item.step}
              className="border border-[var(--border)] rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setExpandedStep(expandedStep === item.step ? null : item.step)}
                className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-[var(--surface-hi)] transition-colors"
                aria-expanded={expandedStep === item.step}
                aria-controls={`step-${item.step}-content`}
              >
                <span className="w-8 h-8 rounded-full bg-[rgba(74,240,184,0.1)] text-[var(--accent)] font-bold flex items-center justify-center text-sm border border-[rgba(74,240,184,0.2)]">
                  {item.step}
                </span>
                <span className="font-semibold text-[var(--text)] flex-1">{item.title}</span>
                <ChevronDown
                  size={16}
                  className={`transition-transform text-[var(--muted)] ${
                    expandedStep === item.step ? 'rotate-180' : ''
                  }`}
                  aria-hidden
                />
              </button>
              {expandedStep === item.step && (
                <div
                  id={`step-${item.step}-content`}
                  className="px-4 py-3 bg-[var(--surface-hi)] text-[var(--muted)] text-sm"
                >
                  {item.description}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card border-[var(--border-hi)] bg-[var(--surface)]/95 rounded-2xl p-6">
        <h3 className="text-lg font-bold mb-4 text-[var(--text)] flex items-center gap-2">
          <Coins size={20} />
          Supported Assets
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ASSET_INFO.map((asset) => (
            <div
              key={asset.code}
              className="p-4 bg-[var(--surface-hi)] rounded-xl border border-[var(--border)]"
            >
              <div className="font-bold text-[var(--accent)] text-lg mb-2">{asset.code}</div>
              <div className="text-xs text-[var(--muted)] font-mono">
                <div className="mb-1">
                  <span className="text-[var(--text)]">Issuer:</span>
                </div>
                <div className="break-all">
                  {asset.issuer === 'Native' ? (
                    <span className="text-[var(--accent)]">Native Asset</span>
                  ) : (
                    <button
                      onClick={() => void copyToClipboard(asset.issuer, `${asset.code} issuer`)}
                      className="hover:text-[var(--accent)] transition-colors text-left"
                      title="Click to copy issuer address"
                    >
                      {truncateAddress(asset.issuer)}
                      <Copy size={12} className="inline ml-1" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {employeeName && (
        <div className="text-center text-sm text-[var(--muted)] p-4 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)]">
          Share this QR code with{' '}
          <span className="font-semibold text-[var(--text)]">{employeeName}</span> so they can
          receive payments directly to their wallet.
        </div>
      )}
    </div>
  );
};
