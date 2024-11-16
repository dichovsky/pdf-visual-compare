import { Area, Color } from 'png-visual-compare';

export type ExcludedPageArea = {
  pageNumber: number;
  excludedAreas?: Area[];
  excludedAreaColor?: Color;
  diffFilePath?: string;
  matchingThreshold?: number;
};
