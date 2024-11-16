import { PdfToPngOptions } from 'pdf-to-png-converter';
import { ExcludedPageArea } from './ExcludedPageArea.js';

export type ComparePdfOptions = {
  diffsOutputFolder?: string;
  pdfToPngConvertOptions?: PdfToPngOptions;
  excludedAreas?: readonly ExcludedPageArea[];
  compareThreshold?: number;
};
