import { Area, Color } from ".";

export type ExcludedPageArea  = {
    pageNumber: number;
    excludedAreas?: Area[];
    excludedAreaColor?: Color;
    diffFilePath?: string;
    matchingThreshold?: number;
}
