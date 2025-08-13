import { useEffect, useRef, useState } from "react";
import { scanImages } from "../utils/imageScanner";
import { scanVideos } from "../utils/videoScanner";

/**
 * Configuration options for the useAssetLoader hook
 */
interface AssetLoaderOptions {
  /**
   * Asset types to scan for loading tracking
   * @default "all" - Scans all supported asset types
   */
  scan?: "all" | ("images" | "videos")[];

  /**
   * Asset types to ignore during scanning
   * @default [] - No assets are ignored
   */
  ignore?: ("images" | "videos")[];
}

/**
 * Return type for the useAssetLoader hook
 */
interface AssetLoaderReturn {
  /** Total number of assets detected on the page */
  totalCount: number;

  /** Number of assets that have loaded successfully */
  loadedCount: number;

  /** Number of assets that failed to load */
  failedCount: number;

  /** Loading progress as a percentage (0-100) */
  progress: number;

  /** Whether all detected assets have finished loading (success or failure) */
  isComplete: boolean;
}

/**
 * Automatically detects and tracks loading progress of all assets on the page
 *
 * This hook provides real-time monitoring of asset loading without requiring developers
 * to manually specify which assets to track. It automatically scans the DOM for assets
 * and reports progress as they load or fail.
 *
 * **Perfect for:**
 * - Splash screen loaders
 * - Progress bars for asset-heavy pages
 * - Performance monitoring
 * - User experience optimization
 *
 * **Currently supports:**
 * - Images (`<img>` elements) - Automatically detects all images in `document.images`
 * - Videos (`<video>` elements) - Automatically detects all videos in `document.querySelectorAll('video')`
 *
 * **Coming soon:**
 * - Fonts, Audio files, and more asset types
 *
 * @param options - Configuration options for asset scanning behavior
 * @param options.scan - Specify which asset types to track ('all' or array of specific types)
 * @param options.ignore - Specify which asset types to skip during scanning
 *
 * @returns Object containing real-time asset loading state and progress
 *
 * @example
 * ```tsx
 * // Basic usage - track all assets automatically
 * function LoadingScreen() {
 *   const { progress, isComplete, loadedCount, totalCount } = useAssetLoader();
 *
 *   if (isComplete) {
 *     return <div>All assets loaded! Ready to go!</div>;
 *   }
 *
 *   return (
 *     <div>
 *       <div>Loading... {progress}%</div>
 *       <div>{loadedCount} of {totalCount} assets loaded</div>
 *       <progress value={progress} max={100} />
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Advanced usage - with configuration options
 * function CustomLoader() {
 *   const { progress, failedCount, isComplete } = useAssetLoader({
 *     scan: ['images'],  // Only track images
 *     ignore: []         // Don't ignore anything
 *   });
 *
 *   return (
 *     <div>
 *       <div>Progress: {progress}%</div>
 *       {failedCount > 0 && <div>Warning: {failedCount} assets failed</div>}
 *       {isComplete && <div>Loading complete!</div>}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Splash screen that disappears when loading is done
 * function App() {
 *   const { isComplete } = useAssetLoader();
 *
 *   if (!isComplete) {
 *     return <SplashScreen />;
 *   }
 *
 *   return <MainApplication />;
 * }
 * ```
 *
 * @since 1.1.0
 * @author Ridha Bennafla <https://github.com/riidha-bennafla>
 */
export function useAssetLoader(
  options: AssetLoaderOptions = { scan: "all" }
): AssetLoaderReturn {
  // Asset counting state
  const [totalCount, setTotalCount] = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  // Calculated state
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  // Prevent double-scanning during React strict mode or re-renders
  const hasScanned = useRef(false);

  // Track total number of assets
  const totalAssets = useRef(0);

  /**
   * Initial asset detection and scanning setup
   * Runs once when the hook is first mounted
   */
  useEffect(() => {
    // Prevent double-scanning during React strict mode or re-renders
    if (hasScanned.current) {
      return;
    }
    hasScanned.current = true;

    // Extract configuration with defaults
    const { scan = "all", ignore = [] } = options;

    // Determine if images should be scanned based on configuration
    const shouldScanImages =
      (scan === "all" || scan.includes("images")) && !ignore.includes("images");

    if (shouldScanImages) {
      /**
       * Start the image scanning process
       * This will:
       * 1. Detect all images on the page
       * 2. Set up tracking for images still loading
       * 3. Update state as images complete loading
       */
      const { totalImages } = scanImages(setLoadedCount, setFailedCount);
      totalAssets.current += totalImages;
    }

    // Determine if videos should be scanned based on configuration
    const shouldScanVideos =
      (scan === "all" || scan.includes("videos")) && !ignore.includes("videos");
    if (shouldScanVideos) {
      /**
       * Start the video scanning process
       * This will:
       * 1. Detect all videos on the page
       * 2. Set up tracking for videos still loading
       * 3. Update state as videos complete loading
       */
      const { totalVideos } = scanVideos(setLoadedCount, setFailedCount);
      totalAssets.current += totalVideos;
    }

    // Set the total asset count
    setTotalCount(totalAssets.current);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run once on mount

  /**
   * Progress calculation and completion detection
   * Recalculates whenever any count changes
   */
  useEffect(() => {
    // Only calculate progress if we have assets to track
    if (totalCount > 0) {
      // Calculate progress percentage (0-100)
      const newProgress = ((loadedCount + failedCount) / totalCount) * 100;
      setProgress(newProgress);

      // Check if all assets are finished (either loaded or failed)
      const allAssetsFinished = loadedCount + failedCount === totalCount;
      setIsComplete(allAssetsFinished);
    }
  }, [loadedCount, failedCount, totalCount]); // Recalculate when any count changes

  return { totalCount, loadedCount, failedCount, progress, isComplete };
}
