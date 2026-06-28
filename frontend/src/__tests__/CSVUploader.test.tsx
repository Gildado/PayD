import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CSVUploader } from '../components/CSVUploader';

vi.mock('../hooks/useNotification', () => ({
  useNotification: () => ({
    notifySuccess: vi.fn(),
    notifyError: vi.fn(),
  }),
}));

const REQUIRED = ['name', 'wallet_address', 'amount'];

function makeFile(content: string, name = 'test.csv'): File {
  return new File([content], name, { type: 'text/csv' });
}

function uploadFile(file: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
}

describe('CSVUploader — RFC 4180 parsing (#956)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses a quoted field containing an embedded comma correctly', async () => {
    const onDataParsed = vi.fn();
    render(
      <CSVUploader
        requiredColumns={REQUIRED}
        onDataParsed={onDataParsed}
        strictHeaderValidation={false}
      />
    );

    // Employee name contains a comma inside quotes — a classic RFC 4180 case
    const csv = [
      'name,wallet_address,amount',
      '"Smith, Alice",GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN,250',
    ].join('\n');

    uploadFile(makeFile(csv));

    await waitFor(() => {
      expect(onDataParsed).toHaveBeenCalled();
    });

    const rows = onDataParsed.mock.calls[0][0];
    expect(rows).toHaveLength(1);
    expect(rows[0].data.name).toBe('Smith, Alice');
    expect(rows[0].data.amount).toBe('250');
  });

  it('parses an escaped double-quote inside a quoted field', async () => {
    const onDataParsed = vi.fn();
    render(
      <CSVUploader
        requiredColumns={REQUIRED}
        onDataParsed={onDataParsed}
        strictHeaderValidation={false}
      />
    );

    // RFC 4180 escape: "" inside a quoted field represents a literal "
    const csv = [
      'name,wallet_address,amount',
      '"O""Brien",GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN,100',
    ].join('\n');

    uploadFile(makeFile(csv));

    await waitFor(() => {
      expect(onDataParsed).toHaveBeenCalled();
    });

    const rows = onDataParsed.mock.calls[0][0];
    expect(rows[0].data.name).toBe('O"Brien');
  });

  it('still works for plain CSV with no quoted fields', async () => {
    const onDataParsed = vi.fn();
    render(
      <CSVUploader
        requiredColumns={REQUIRED}
        onDataParsed={onDataParsed}
        strictHeaderValidation={false}
      />
    );

    const csv = [
      'name,wallet_address,amount',
      'Alice,GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN,500',
    ].join('\n');

    uploadFile(makeFile(csv));

    await waitFor(() => {
      expect(onDataParsed).toHaveBeenCalled();
    });

    const rows = onDataParsed.mock.calls[0][0];
    expect(rows[0].data.name).toBe('Alice');
    expect(rows[0].data.amount).toBe('500');
  });

  it('reports an error when a required column is missing', async () => {
    const onDataParsed = vi.fn();
    render(
      <CSVUploader
        requiredColumns={REQUIRED}
        onDataParsed={onDataParsed}
        strictHeaderValidation={false}
      />
    );

    const csv = [
      'name,wallet_address',
      'Alice,GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
    ].join('\n');

    uploadFile(makeFile(csv));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/missing required columns/i);
    });

    expect(onDataParsed).not.toHaveBeenCalled();
  });
});
