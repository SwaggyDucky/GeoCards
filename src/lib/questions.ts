import { z } from "zod";
import type { CountryEntry, CountryItem, Question, QuestionImage } from "../types";

export const countryItemSchema = z.object({
  type: z.string().min(1),
  images: z.array(z.string().min(1)).min(1),
});

export const countryEntrySchema = z.object({
  country: z.string().min(1),
  region: z.string().min(1),
  items: z.array(countryItemSchema).min(1),
});

export const datasetSchema = z.array(countryEntrySchema).min(1);

export type ValidatedDataset = z.infer<typeof datasetSchema>;

const MIN_CLUES = 3;

export interface QuestionOptions {
  clueCount?: number;
  region?: string;
  itemType?: string;
}

export const shuffleArray = <T>(arr: T[]): T[] => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export const validItems = (items: CountryItem[] | null | undefined): CountryItem[] =>
  (items ?? []).filter((item) => Array.isArray(item.images) && item.images.length > 0);

export const getCountries = (data: CountryEntry[] | null): string[] => (data ?? []).map((entry) => entry.country);

const gatherImages = (items: CountryItem[], itemType?: string): QuestionImage[] => {
  const targetType = itemType?.toLowerCase();
  const usableItems = validItems(items).filter((item) => {
    if (!targetType) return true;
    return item.type.toLowerCase() === targetType;
  });

  const images: QuestionImage[] = [];
  for (const item of usableItems) {
    for (const img of item.images) {
      images.push({ url: img, type: item.type });
    }
  }

  return images;
};

export const buildQuestion = (entry: CountryEntry, options: QuestionOptions = {}): Question | null => {
  const clueCount = options.clueCount ?? MIN_CLUES;
  const imagesPool = gatherImages(entry.items, options.itemType);
  if (imagesPool.length < clueCount) {
    return null;
  }

  const images = shuffleArray(imagesPool).slice(0, clueCount);
  return {
    correctCountry: entry.country,
    images,
  };
};

export const pickQuestion = (dataset: CountryEntry[] | null, options: QuestionOptions = {}): Question | null => {
  const clueCount = options.clueCount ?? MIN_CLUES;
  const candidates = (dataset ?? []).filter((entry) => {
    if (options.region && entry.region !== options.region) {
      return false;
    }
    const imagesPool = gatherImages(entry.items, options.itemType);
    return imagesPool.length >= clueCount;
  });

  if (candidates.length === 0) {
    return null;
  }

  const correct = candidates[Math.floor(Math.random() * candidates.length)];
  return buildQuestion(correct, options);
};

export const validateDataset = (input: unknown): CountryEntry[] => datasetSchema.parse(input);

export const getRegions = (data: CountryEntry[] | null): string[] => {
  const regions = new Set<string>();
  for (const entry of data ?? []) {
    if (entry.region) {
      regions.add(entry.region);
    }
  }
  return Array.from(regions).sort((a, b) => a.localeCompare(b));
};

export const getItemTypes = (data: CountryEntry[] | null): string[] => {
  const types = new Map<string, string>();
  for (const entry of data ?? []) {
    for (const item of entry.items ?? []) {
      if (!item?.type) continue;
      const key = item.type.toLowerCase();
      if (!types.has(key)) {
        types.set(key, item.type);
      }
    }
  }
  return Array.from(types.values()).sort((a, b) => a.localeCompare(b));
};
