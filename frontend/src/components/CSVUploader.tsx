import React, { useState, useRef } from 'react';
import { Upload, AlertCircle, CheckCircle } from 'lucide-react';

export interface CSVRow {
  rowNumber: number;
  data: Record<string, string>;
  errors: string[];
  isValid: boolean;
}

interface CSVUploaderProps {
  requiredColumns: string[];
  onDataParsed: (data: CSVRow[]) => void;
  validators?: Record<string, (value: string) => string | null>;
}

export const CSVUploader: React.FC<CSVUploaderProps> = ({
  requiredColumns,
  onDataParsed,
  validators = {},
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [parsedData, setParsedData] = useState<CSVRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = (content: string): CSVRow[] => {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map((h) => h.trim());

    // Validate headers
    const missingColumns = requiredColumns.filter((col) => !headers.includes(col));
    if (missingColumns.length > 0) {
      alert(`Missing required columns: ${missingColumns.join(', ')}`);
      return [];
    }

    const rows: CSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim());
      const row: Record<string, string> = {};
      const errors: string[] = [];

      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });

      // Validate each field
      requiredColumns.forEach((col) => {
        if (!row[col]) {
          errors.push(`Missing required field: ${col}`);
        }
      });

      // Run custom validators
      Object.entries(validators).forEach(([field, validator]) => {
        if (row[field]) {
          const error = validator(row[field]);
          if (error) {
            errors.push(error);
          }
        }
      });

      rows.push({
        rowNumber: i + 1,
        data: row,
        errors,
        isValid: errors.length === 0,
      });
    }

    return rows;
  };

  const handleFileParse = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      alert('Please upload a CSV file');
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target?.result as string;
      const rows = parseCSV(content);
      setParsedData(rows);
      onDataParsed(rows);
    };

    reader.readAsText(file);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileParse(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileParse(file);
    }
  };

  const validRowsCount = parsedData.filter((r) => r.isValid).length;
  const invalidRowsCount = parsedData.filter((r) => !r.isValid).length;

  return (
    <div className="w-full">
      {/* Upload Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition cursor-pointer ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-gray-50 hover:border-gray-400'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="hidden"
        />

        <button onClick={() => fileInputRef.current?.click()} className="w-full">
          <Upload className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p className="text-lg font-semibold text-gray-700">Drag and drop your CSV file</p>
          <p className="text-sm text-gray-500 mt-1">or click to browse</p>
          <p className="text-xs text-gray-400 mt-2">
            Required columns: {requiredColumns.join(', ')}
          </p>
        </button>
      </div>

      {/* File info */}
      {fileName && (
        <div className="mt-4 text-left p-3 bg-transparent border rounded text-sm">
          <p className="font-semibold">File: {fileName}</p>
          <div className="mt-2 flex gap-4 text-sm">
            <span className="flex items-center gap-1">
              <CheckCircle className="w-4 h-4 text-green-100" />
              {validRowsCount} valid rows
            </span>
            {invalidRowsCount > 0 && (
              <span className="flex items-center gap-1">
                <AlertCircle className="w-4 h-4 text-red-500" />
                {invalidRowsCount} rows with errors
              </span>
            )}
          </div>
        </div>
      )}

      {/* Preview Table */}
      {parsedData.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-4">Preview</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-2 text-left font-semibold">Row</th>
                  <th className="px-4 py-2 text-left font-semibold">Status</th>
                  {Object.keys(parsedData[0]?.data || {}).map((col) => (
                    <th key={col} className="px-4 py-2 text-left font-semibold">
                      {col}
                    </th>
                  ))}
                  <th className="px-4 py-2 text-left font-semibold">Errors</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {parsedData.map((row) => (
                  <tr
                    key={row.rowNumber}
                    className={`border-b transition ${
                      row.isValid ? 'bg-transparent' : 'bg-red-50'
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-gray-100">{row.rowNumber}</td>
                    <td className="px-4 py-3">
                      {row.isValid ? (
                        <CheckCircle className="w-5 h-5 text-green-100" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-100" />
                      )}
                    </td>

                    {Object.entries(row.data).map(([col, value]) => (
                      <td
                        key={`${row.rowNumber}-${col}`}
                        className="px-4 py-3 text-gray-100 truncate"
                      >
                        {value}
                      </td>
                    ))}

                    <td className="px-4 py-3 text-red-600 text-xs">
                      {row.errors.length > 0 ? (
                        <ul className="space-y-1">
                          {row.errors.map((error) => (
                            <li key={`${row.rowNumber}-${error}`}>• {error}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-green-600">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
