
import { PdfToPngOptions, ExcludedPageArea } from '.';

export type ComparePdfOptions = {
    diffsOutputFolder?: string;
    pdfToPngConvertOptions?: PdfToPngOptions,
    excludedAreas: ExcludedPageArea[];
};
