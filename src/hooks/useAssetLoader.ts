import { useState, useCallback } from "react";
import { AssetLoaderReturn } from "../types";

export function useAssetLoader(): AssetLoaderReturn {
  const [loadedCount, setLoadedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const progress =
    totalCount > 0 ? Math.round((loadedCount / totalCount) * 100) : 0;
  const isComplete = totalCount > 0 && loadedCount === totalCount;

  const onAssetLoaded = useCallback(() => {
    setLoadedCount((prev) => prev + 1);
  }, []);

  const incrementTotal = useCallback(() => {
    setTotalCount((prev) => prev + 1);
  }, []);

  const loadImage = useCallback(
    async (src: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        incrementTotal();
        const img = new Image();
        img.onload = () => {
          onAssetLoaded();
          resolve();
        };
        img.onerror = reject;
        img.src = src;
      });
    },
    [incrementTotal, onAssetLoaded]
  );

  const loadFont = useCallback(
    async (fontFamily: string, src?: string): Promise<void> => {
      incrementTotal();
      // Simple font loading - we'll improve this
      setTimeout(() => {
        onAssetLoaded();
      }, 100);
    },
    [incrementTotal, onAssetLoaded]
  );

  const loadVideo = useCallback(
    async (src: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        incrementTotal();
        const video = document.createElement("video");
        video.onloadeddata = () => {
          onAssetLoaded();
          resolve();
        };
        video.onerror = reject;
        video.src = src;
      });
    },
    [incrementTotal, onAssetLoaded]
  );

  const reset = useCallback(() => {
    setLoadedCount(0);
    setTotalCount(0);
  }, []);

  return {
    loadedCount,
    totalCount,
    progress,
    isComplete,
    loadImage,
    loadFont,
    loadVideo,
    reset,
  };
}
