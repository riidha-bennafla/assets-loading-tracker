export type AssetType = "image" | "font" | "video";

export interface AssetLoaderReturn {
  loadedCount: number;
  totalCount: number;
  progress: number;
  isComplete: boolean;
  loadImage: (src: string) => Promise<void>;
  loadFont: (fontFamily: string, src?: string) => Promise<void>;
  loadVideo: (src: string) => Promise<void>;
  reset: () => void;
}
