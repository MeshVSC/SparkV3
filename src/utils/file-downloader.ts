import { saveAs } from 'file-saver';

export interface DownloadOptions {
  filename: string;
  mimeType?: string;
  charset?: string;
}

export interface DownloadResult {
  success: boolean;
  error?: string;
}

/**
 * MIME type constants for common file formats
 */
export const MIME_TYPES = {
  PDF: 'application/pdf',
  CSV: 'text/csv',
  JSON: 'application/json',
  XML: 'application/xml',
  TXT: 'text/plain',
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ZIP: 'application/zip',
  PNG: 'image/png',
  JPEG: 'image/jpeg',
  SVG: 'image/svg+xml',
} as const;

/**
 * Download a blob as a file
 */
export function downloadBlob(
  blob: Blob,
  options: DownloadOptions
): DownloadResult {
  try {
    const { filename, mimeType, charset } = options;

    // Create a new blob with specified MIME type if provided
    const downloadBlob = mimeType 
      ? new Blob([blob], { 
          type: charset ? `${mimeType};charset=${charset}` : mimeType 
        })
      : blob;

    saveAs(downloadBlob, filename);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Download failed',
    };
  }
}

/**
 * Download text content as a file
 */
export function downloadText(
  content: string,
  options: DownloadOptions
): DownloadResult {
  try {
    const { filename, mimeType = MIME_TYPES.TXT, charset = 'utf-8' } = options;

    const blob = new Blob([content], { 
      type: `${mimeType};charset=${charset}` 
    });

    saveAs(blob, filename);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Download failed',
    };
  }
}

/**
 * Download JSON data as a file
 */
export function downloadJson<T = any>(
  data: T,
  options: Omit<DownloadOptions, 'mimeType'> & { mimeType?: string }
): DownloadResult {
  try {
    const { filename, mimeType = MIME_TYPES.JSON, charset = 'utf-8' } = options;

    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { 
      type: `${mimeType};charset=${charset}` 
    });

    saveAs(blob, filename);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to serialize or download JSON',
    };
  }
}

/**
 * Download CSV content as a file
 */
export function downloadCsv(
  csvContent: string,
  options: Omit<DownloadOptions, 'mimeType'> & { mimeType?: string }
): DownloadResult {
  try {
    const { filename, mimeType = MIME_TYPES.CSV, charset = 'utf-8' } = options;

    const blob = new Blob([csvContent], { 
      type: `${mimeType};charset=${charset}` 
    });

    saveAs(blob, filename);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'CSV download failed',
    };
  }
}

/**
 * Download PDF blob as a file
 */
export function downloadPdf(
  pdfBlob: Blob,
  filename: string
): DownloadResult {
  return downloadBlob(pdfBlob, {
    filename: filename.endsWith('.pdf') ? filename : `${filename}.pdf`,
    mimeType: MIME_TYPES.PDF,
  });
}

/**
 * Generate and download a file from a data URL
 */
export function downloadFromDataUrl(
  dataUrl: string,
  options: DownloadOptions
): DownloadResult {
  try {
    const { filename } = options;

    // Convert data URL to blob
    const [header, data] = dataUrl.split(',');
    const mime = header.match(/:(.*?);/)?.[1] || 'application/octet-stream';
    const binary = atob(data);
    const array = new Uint8Array(binary.length);
    
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }

    const blob = new Blob([array], { type: mime });
    saveAs(blob, filename);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Data URL download failed',
    };
  }
}

/**
 * Create a download URL for a blob (for use with anchor tags)
 */
export function createDownloadUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

/**
 * Revoke a download URL to free memory
 */
export function revokeDownloadUrl(url: string): void {
  URL.revokeObjectURL(url);
}

/**
 * Helper to format filename with timestamp
 */
export function timestampFilename(
  baseName: string,
  extension: string,
  separator: string = '_'
): string {
  const timestamp = new Date().toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, -5); // Remove milliseconds and Z
  
  return `${baseName}${separator}${timestamp}.${extension}`;
}

/**
 * Sanitize filename to remove invalid characters
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}