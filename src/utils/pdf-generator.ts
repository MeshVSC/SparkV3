import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface PdfGenerationOptions {
  filename?: string;
  format?: 'a4' | 'a3' | 'letter';
  orientation?: 'portrait' | 'landscape';
  quality?: number;
  scale?: number;
  useCORS?: boolean;
  allowTaint?: boolean;
}

export interface PdfGenerationResult {
  success: boolean;
  blob?: Blob;
  error?: string;
}

/**
 * Generate PDF from DOM element using html2canvas and jsPDF
 */
export async function generatePdfFromElement(
  element: HTMLElement,
  options: PdfGenerationOptions = {}
): Promise<PdfGenerationResult> {
  try {
    const {
      filename = 'document.pdf',
      format = 'a4',
      orientation = 'portrait',
      quality = 1,
      scale = 2,
      useCORS = true,
      allowTaint = false,
    } = options;

    // Generate canvas from DOM element
    const canvas = await html2canvas(element, {
      scale,
      useCORS,
      allowTaint,
      backgroundColor: '#ffffff',
      logging: false,
    });

    // Create PDF document
    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format,
    });

    // Calculate dimensions
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Calculate scale to fit content
    const ratio = Math.min(pdfWidth / canvasWidth, pdfHeight / canvasHeight);
    const width = canvasWidth * ratio;
    const height = canvasHeight * ratio;

    // Center the image
    const x = (pdfWidth - width) / 2;
    const y = (pdfHeight - height) / 2;

    // Add image to PDF
    const imgData = canvas.toDataURL('image/png', quality);
    pdf.addImage(imgData, 'PNG', x, y, width, height);

    // Generate blob
    const blob = pdf.output('blob');

    return {
      success: true,
      blob,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Generate PDF from multiple DOM elements (multi-page)
 */
export async function generateMultiPagePdf(
  elements: HTMLElement[],
  options: PdfGenerationOptions = {}
): Promise<PdfGenerationResult> {
  try {
    const {
      format = 'a4',
      orientation = 'portrait',
      quality = 1,
      scale = 2,
      useCORS = true,
      allowTaint = false,
    } = options;

    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format,
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];

      // Add new page for subsequent elements
      if (i > 0) {
        pdf.addPage();
      }

      // Generate canvas
      const canvas = await html2canvas(element, {
        scale,
        useCORS,
        allowTaint,
        backgroundColor: '#ffffff',
        logging: false,
      });

      // Calculate dimensions and positioning
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const ratio = Math.min(pdfWidth / canvasWidth, pdfHeight / canvasHeight);
      const width = canvasWidth * ratio;
      const height = canvasHeight * ratio;
      const x = (pdfWidth - width) / 2;
      const y = (pdfHeight - height) / 2;

      // Add image to current page
      const imgData = canvas.toDataURL('image/png', quality);
      pdf.addImage(imgData, 'PNG', x, y, width, height);
    }

    const blob = pdf.output('blob');

    return {
      success: true,
      blob,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Generate PDF with custom content using jsPDF directly
 */
export function generatePdfWithContent(
  content: string,
  options: PdfGenerationOptions = {}
): PdfGenerationResult {
  try {
    const {
      format = 'a4',
      orientation = 'portrait',
    } = options;

    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format,
    });

    // Add text content
    const lines = pdf.splitTextToSize(content, pdf.internal.pageSize.getWidth() - 20);
    pdf.text(lines, 10, 20);

    const blob = pdf.output('blob');

    return {
      success: true,
      blob,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}