import { ExcludedPageArea, PdfToPngOptions } from '.';

export type ComparePdfOptions = {
  diffsOutputFolder?: string;
  pdfToPngConvertOptions?: PdfToPngOptions;
  excludedAreas?: ExcludedPageArea[];
  compareThreshold?: number;
};
