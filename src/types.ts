export interface CountryItem {
  type: string;
  images: string[];
}

export interface CountryEntry {
  country: string;
  region: string;
  items: CountryItem[];
}

export interface QuestionImage {
  url: string;
  type: string;
}

export interface Question {
  correctCountry: string;
  images: QuestionImage[];
}

export interface GameMetrics {
  score: number;
  answered: number;
  streak: number;
}
