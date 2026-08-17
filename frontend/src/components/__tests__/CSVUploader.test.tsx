import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { CSVUploader } from '../CSVUploader';
import '../../i18n';

const mockNotifySuccess = vi.fn();
const mockNotifyError = vi.fn();

vi.mock('../../hooks/useNotification', () => ({
  useNotification: () => ({
    notifySuccess: mockNotifySuccess,
    notifyError: mockNotifyError,
  }),
}));

const createCSVContent = (headers: string[], rows: string[][]) => {
  const headerLine = headers.join(',');
  const dataLines = rows.map((row) => row.join(','));
  return [headerLine, ...dataLines].join('\n');
};

const createMockFile = (content: string, name = 'test.csv'): File => {
  const blob = new Blob([content], { type: 'text/csv' });
  return new File([blob], name, { type: 'text/csv' });
};

describe('CSVUploader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders upload zone with required columns info', () => {
    render(<CSVUploader requiredColumns={['name', 'email']} onDataParsed={vi.fn()} />);

    expect(screen.getByRole('region', { name: /csv file upload/i })).toBeTruthy();
    expect(screen.getByText(/required columns:/i)).toBeTruthy();
    expect(screen.getByText(/name, email/i)).toBeTruthy();
  });

  test('upload zone has button role and is keyboard accessible', () => {
    render(<CSVUploader requiredColumns={['name']} onDataParsed={vi.fn()} />);

    const zone = screen.getByRole('button', { name: /upload csv file/i });
    expect(zone).toBeTruthy();
    expect(zone.getAttribute('tabindex')).toBe('0');
  });

  test('parses valid CSV file and calls onDataParsed', async () => {
    const onDataParsed = vi.fn();
    const csvContent = createCSVContent(
      ['name', 'email', 'amount'],
      [
        ['John', 'john@test.com', '100'],
        ['Jane', 'jane@test.com', '200'],
      ]
    );
    const file = createMockFile(csvContent);

    render(
      <CSVUploader requiredColumns={['name', 'email', 'amount']} onDataParsed={onDataParsed} />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(onDataParsed).toHaveBeenCalled();
    });

    const data = onDataParsed.mock.calls[0][0];
    expect(data).toHaveLength(2);
    expect(data[0].isValid).toBe(true);
    expect(data[1].isValid).toBe(true);
    expect(data[0].data.name).toBe('John');
  });

  test('shows error for non-CSV file', async () => {
    const blob = new Blob(['not a csv'], { type: 'text/plain' });
    const file = new File([blob], 'test.txt', { type: 'text/plain' });

    render(<CSVUploader requiredColumns={['name']} onDataParsed={vi.fn()} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockNotifyError).toHaveBeenCalledWith(
        'Invalid file format',
        'Only .csv files are accepted.'
      );
    });
  });

  test('shows error for missing required columns', async () => {
    const csvContent = createCSVContent(['name'], [['John']]);
    const file = createMockFile(csvContent);

    render(<CSVUploader requiredColumns={['name', 'email']} onDataParsed={vi.fn()} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.getByText(/missing required columns/i)).toBeTruthy();
    });
  });

  test('shows drag state on drag enter', () => {
    render(<CSVUploader requiredColumns={['name']} onDataParsed={vi.fn()} />);

    const zone = screen.getByRole('button', { name: /upload csv file/i });
    fireEvent.dragEnter(zone);

    expect(zone.className).toContain('border-[var(--accent)]');
  });

  test('marks rows with missing required fields as invalid', async () => {
    const onDataParsed = vi.fn();
    const csvContent = createCSVContent(
      ['name', 'email'],
      [
        ['John', ''],
        ['', 'jane@test.com'],
      ]
    );
    const file = createMockFile(csvContent);

    render(<CSVUploader requiredColumns={['name', 'email']} onDataParsed={onDataParsed} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(onDataParsed).toHaveBeenCalled();
    });

    const data = onDataParsed.mock.calls[0][0];
    expect(data[0].isValid).toBe(false);
    expect(data[1].isValid).toBe(false);
  });

  test('runs custom validators on parsed data', async () => {
    const onDataParsed = vi.fn();
    const csvContent = createCSVContent(['name', 'amount'], [['John', '50']]);
    const file = createMockFile(csvContent);
    const validators = {
      amount: (value: string) => {
        const num = Number(value);
        return num < 100 ? 'Amount must be at least 100' : null;
      },
    };

    render(
      <CSVUploader
        requiredColumns={['name', 'amount']}
        onDataParsed={onDataParsed}
        validators={validators}
      />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(onDataParsed).toHaveBeenCalled();
    });

    const data = onDataParsed.mock.calls[0][0];
    expect(data[0].errors).toContain('Amount must be at least 100');
  });

  test('shows success notification on valid parse', async () => {
    const csvContent = createCSVContent(['name', 'email'], [['John', 'john@test.com']]);
    const file = createMockFile(csvContent);

    render(<CSVUploader requiredColumns={['name', 'email']} onDataParsed={vi.fn()} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockNotifySuccess).toHaveBeenCalledWith(
        'CSV parsed successfully',
        '1 row ready to upload'
      );
    });
  });

  test('shows file summary after successful parse', async () => {
    const csvContent = createCSVContent(
      ['name', 'email'],
      [
        ['John', 'john@test.com'],
        ['Jane', 'jane@test.com'],
      ]
    );
    const file = createMockFile(csvContent);

    render(<CSVUploader requiredColumns={['name', 'email']} onDataParsed={vi.fn()} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('test.csv')).toBeTruthy();
      expect(screen.getByText(/2 of 2 rows valid/i)).toBeTruthy();
    });
  });

  test('displays data preview table after parsing', async () => {
    const csvContent = createCSVContent(['name', 'email'], [['John', 'john@test.com']]);
    const file = createMockFile(csvContent);

    render(<CSVUploader requiredColumns={['name', 'email']} onDataParsed={vi.fn()} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Data Preview')).toBeTruthy();
    });

    expect(screen.getByText('John')).toBeTruthy();
  });

  test('handles duplicate columns error', async () => {
    const csvContent = 'name,name,email\nJohn,Smith,john@test.com';
    const file = createMockFile(csvContent);

    render(<CSVUploader requiredColumns={['name', 'email']} onDataParsed={vi.fn()} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.getByText(/duplicate columns found/i)).toBeTruthy();
    });
  });

  test('exposes structured field-level errors for invalid rows', async () => {
    const onDataParsed = vi.fn();
    const csvContent = createCSVContent(['name', 'email', 'amount'], [['John', '', '50']]);
    const file = createMockFile(csvContent);
    const validators = {
      amount: (value: string) => (Number(value) < 100 ? 'Amount must be at least 100' : null),
    };

    render(
      <CSVUploader
        requiredColumns={['name', 'email', 'amount']}
        onDataParsed={onDataParsed}
        validators={validators}
      />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(onDataParsed).toHaveBeenCalled();
    });

    const data = onDataParsed.mock.calls[0][0];
    expect(data[0].isValid).toBe(false);
    expect(data[0].fieldErrors).toEqual(
      expect.arrayContaining([
        { field: 'email', message: 'Missing required field: email' },
        { field: 'amount', message: 'Amount must be at least 100' },
      ])
    );
  });

  test('renders a dedicated row error table with row number, field, and message', async () => {
    const csvContent = createCSVContent(
      ['name', 'email'],
      [
        ['John', 'john@test.com'],
        ['', 'jane@test.com'],
      ]
    );
    const file = createMockFile(csvContent);

    render(<CSVUploader requiredColumns={['name', 'email']} onDataParsed={vi.fn()} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/1 row error/i)).toBeTruthy();
    });

    const table = screen.getByRole('table', { name: /table of validation errors/i });
    expect(table.textContent).toContain('3'); // row number (header + 2 data rows -> row 3)
    expect(table.textContent).toContain('name');
    expect(table.textContent).toContain('Missing required field: name');
  });

  test('summary bar shows X of Y rows valid and Z rows with errors', async () => {
    const csvContent = createCSVContent(
      ['name', 'email'],
      [
        ['John', 'john@test.com'],
        ['', 'jane@test.com'],
      ]
    );
    const file = createMockFile(csvContent);

    render(<CSVUploader requiredColumns={['name', 'email']} onDataParsed={vi.fn()} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/1 of 2 rows valid/i)).toBeTruthy();
      expect(screen.getByText(/1 row with errors/i)).toBeTruthy();
    });
  });

  test('download errors button exports only the failed rows as CSV', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    const csvContent = createCSVContent(
      ['name', 'email'],
      [
        ['John', 'john@test.com'],
        ['', 'jane@test.com'],
      ]
    );
    const file = createMockFile(csvContent);

    render(<CSVUploader requiredColumns={['name', 'email']} onDataParsed={vi.fn()} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    const exportButton = await screen.findByRole('button', { name: /export errors/i });
    fireEvent.click(exportButton);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    const blobText = await new Promise<string>((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.onload = () => resolve(fileReader.result as string);
      fileReader.onerror = () => reject(new Error('Failed to read blob in test'));
      fileReader.readAsText(blob);
    });
    expect(blobText).toContain('jane@test.com');
    expect(blobText).not.toContain('john@test.com');

    createObjectURL.mockRestore();
  });

  test('rejects files larger than the 50MB limit', async () => {
    const file = createMockFile('name,email\nJohn,john@test.com');
    Object.defineProperty(file, 'size', { value: 51 * 1024 * 1024 });

    render(<CSVUploader requiredColumns={['name', 'email']} onDataParsed={vi.fn()} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.getByText(/50\.0MB limit/i)).toBeTruthy();
    });
  });

  test('parses large files in chunks without dropping rows', async () => {
    const onDataParsed = vi.fn();
    const rowCount = 1200; // spans multiple CHUNK_SIZE (500) batches
    const rows = Array.from({ length: rowCount }, (_, i) => [`User${i}`, `user${i}@test.com`]);
    const csvContent = createCSVContent(['name', 'email'], rows);
    const file = createMockFile(csvContent);

    render(<CSVUploader requiredColumns={['name', 'email']} onDataParsed={onDataParsed} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(
      () => {
        expect(onDataParsed).toHaveBeenCalled();
      },
      { timeout: 10000 }
    );

    const data = onDataParsed.mock.calls[0][0];
    expect(data).toHaveLength(rowCount);
    expect(data.every((row: { isValid: boolean }) => row.isValid)).toBe(true);
  });
});
