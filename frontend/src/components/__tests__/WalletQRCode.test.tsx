import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const notifySuccessMock = vi.fn();

vi.mock('../../hooks/useNotification', () => ({
  useNotification: () => ({ notifySuccess: notifySuccessMock }),
}));

vi.mock('@stellar/design-system', () => ({
  Button: ({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

import { WalletQRCode } from '../WalletQRCode';

const TEST_ADDRESS = 'GABCDEF12345678901234567890123456789012345678901234567890123';

describe('WalletQRCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn(() => 'blob:test');

    // jsdom doesn't fire img.onload — make it fire synchronously when src is set
    vi.spyOn(window, 'Image').mockImplementation(function () {
      const img = { width: 160, height: 160 } as HTMLImageElement;
      Object.defineProperty(img, 'src', {
        set(url: string) {
          void url;
          if (typeof img.onload === 'function') img.onload(new Event('load'));
        },
        get() {
          return '';
        },
      });
      return img;
    });

    // jsdom doesn't implement canvas — provide minimal stubs
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => ({ drawImage: vi.fn() }) as unknown as CanvasRenderingContext2D
    );
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,test');
  });

  it('renders download button and triggers download on click', () => {
    const createElementSpy = vi.spyOn(document, 'createElement');
    render(<WalletQRCode walletAddress={TEST_ADDRESS} />);

    const downloadBtn = screen.getByRole('button', { name: /download qr/i });
    expect(downloadBtn).toBeTruthy();

    fireEvent.click(downloadBtn);

    const anchorCalls = createElementSpy.mock.results.filter((r) => r.value?.tagName === 'A');
    expect(anchorCalls.length).toBeGreaterThan(0);

    const anchor = anchorCalls[0].value;
    expect(anchor.download).toContain('.png');
    expect(anchor.href).toBeTruthy();
  });

  it('renders print button', () => {
    render(<WalletQRCode walletAddress={TEST_ADDRESS} />);
    expect(screen.getByRole('button', { name: /print qr/i })).toBeTruthy();
  });

  it('calls window.open on print click', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({
      document: {
        write: vi.fn(),
        close: vi.fn(),
      },
      focus: vi.fn(),
      print: vi.fn(),
    } as unknown as Window);

    render(<WalletQRCode walletAddress={TEST_ADDRESS} />);
    fireEvent.click(screen.getByRole('button', { name: /print qr/i }));

    expect(openSpy).toHaveBeenCalledWith('', '_blank');
    openSpy.mockRestore();
  });
});
