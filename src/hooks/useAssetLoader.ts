import { useEffect, useRef, useState } from "react";
import { scanImages } from "../utils/imageScanner";
import { scanVideos } from "../utils/videoScanner";
import { scanAudios } from "../utils/audioScanner";
import { scanFonts } from "../utils/fontScanner";

/**
 * Configuration options for the useAssetLoader hook
 */
interface AssetLoaderOptions {
  /**
   * Asset types to scan for loading tracking
   * @default "all" - Scans all supported asset types
   */
  scan?: "all" | ("images" | "videos" | "audios" | "fonts")[];

  /**
   * Asset types to ignore during scanning
   * @default [] - No assets are ignored
   */
  ignore?: ("images" | "videos" | "audios" | "fonts")[];
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
 * and reports progress as they load or fail, making it perfect for creating loading
 * screens, progress bars, and optimizing user experience.
 *
 * **Perfect Use Cases:**
 * - Splash screen loaders that disappear when assets are ready
 * - Progress bars for asset-heavy pages (portfolios, galleries, media sites)
 * - Performance monitoring and user experience optimization
 * - Preventing layout shifts by waiting for critical assets
 *
 * **Fully Supported Asset Types:**
 * - **Images** (`<img>` elements) - Automatically detects all images via document.images
 * - **Videos** (`<video>` elements) - Tracks video loading with timeout protection
 * - **Audio** (`<audio>` elements) - Monitors audio file loading with timeout protection
 * - **Fonts** (Web fonts) - Detects @font-face, Google Fonts, and custom fonts
 *
 * **Advanced Features:**
 * - **Automatic Detection**: Zero manual configuration - scans entire DOM automatically
 * - **Timeout Protection**: 7-second timeout prevents stuck progress on problematic assets
 * - **Real-time Progress**: Live updates as assets load, fail, or timeout
 * - **Error Resilience**: Failed/timed-out assets don't prevent completion (progress still reaches 100%)
 * - **Flexible Configuration**: Choose specific asset types or ignore certain categories
 * - **Performance Optimized**: Efficient scanning with minimal impact on page load times
 *
 * **Coming Soon:**
 * - CSS stylesheet loading detection
 * - PDF and document file tracking
 * - Dynamic import monitoring
 * - Custom asset type support
 *
 * @param options - Optional configuration object for customizing scanning behavior
 * @param options.scan - Specify which asset types to track ("all" or array of specific types)
 * @param options.ignore - Specify which asset types to skip during scanning
 *
 * @returns Object containing real-time asset loading state and progress information
 *
 * @example
 * ```tsx
 * // Basic usage - automatically track all assets
 * function LoadingScreen() {
 *   const { progress, isComplete, loadedCount, totalCount } = useAssetLoader();
 *
 *   if (isComplete) {
 *     return <div>All assets loaded! Welcome! 🎉</div>;
 *   }
 *
 *   return (
 *     <div className="loading-screen">
 *       <h1>Loading your experience...</h1>
 *       <div className="progress-bar">
 *         <div
 *           className="progress-fill"
 *           style={{ width: `${progress}%` }}
 *         />
 *       </div>
 *       <p>{loadedCount} of {totalCount} assets ready</p>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Advanced usage - selective asset tracking with error handling
 * function SmartLoader() {
 *   const {
 *     progress,
 *     loadedCount,
 *     totalCount,
 *     failedCount,
 *     isComplete
 *   } = useAssetLoader({
 *     scan: ['images', 'fonts'],  // Only track images and fonts
 *     ignore: ['videos']          // Skip video files (maybe they're not critical)
 *   });
 *
 *   return (
 *     <div className="smart-loader">
 *       <div className="status">
 *         Loading: {progress.toFixed(1)}% complete
 *       </div>
 *       <div className="details">
 *         ✅ {loadedCount} loaded
 *         {failedCount > 0 && ` • ⚠️ ${failedCount} failed`}
 *         {` • 📦 ${totalCount} total`}
 *       </div>
 *       {failedCount > 0 && (
 *         <div className="warning">
 *           Some assets couldn't load, but we'll continue anyway!
 *         </div>
 *       )}
 *       {isComplete && (
 *         <div className="success">Ready to explore! 🚀</div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Conditional app rendering - classic splash screen pattern
 * function App() {
 *   const { isComplete, progress } = useAssetLoader();
 *
 *   // Show loading screen until all assets are ready
 *   if (!isComplete) {
 *     return (
 *       <SplashScreen
 *         progress={progress}
 *         message="Preparing your experience..."
 *       />
 *     );
 *   }
 *
 *   // Render main application only when assets are loaded
 *   return <MainApplication />;
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Performance monitoring and analytics
 * function PerformanceAwareApp() {
 *   const { progress, loadedCount, failedCount, isComplete } = useAssetLoader();
 *
 *   useEffect(() => {
 *     if (isComplete) {
 *       // Send analytics data
 *       analytics.track('Assets Loaded', {
 *         totalLoaded: loadedCount,
 *         totalFailed: failedCount,
 *         loadTime: Date.now() - startTime
 *       });
 *     }
 *   }, [isComplete, loadedCount, failedCount]);
 *
 *   return <YourApp />;
 * }
 * ```
 *
 * **Technical Implementation Notes:**
 * - Runs asset detection once on component mount to prevent duplicate scanning
 * - Uses React.useRef to prevent re-scanning during strict mode or re-renders
 * - Employs functional state updates for thread-safe concurrent asset loading
 * - Implements Promise.race() pattern for timeout protection on media assets
 * - Optimized for both small sites (few assets) and large applications (hundreds of assets)
 *
 * **Browser Compatibility:**
 * - Modern browsers with ES6+ support
 * - Requires FontFace API support for font tracking (Chrome 35+, Firefox 41+, Safari 10+)
 * - Gracefully degrades if specific APIs are unavailable
 *
 * @since 1.1.0
 * @author Ridha Bennafla <https://github.com/riidha-bennafla>
 * @see {@link https://www.npmjs.com/package/assets-loading-tracker} NPM Package
 */
export function useAssetLoader(
  options?: AssetLoaderOptions
): AssetLoaderReturn {
  // ===== STATE MANAGEMENT =====

  /** Total number of assets detected across all scanners */
  const [totalCount, setTotalCount] = useState(0);

  /** Number of assets that have successfully loaded */
  const [loadedCount, setLoadedCount] = useState(0);

  /** Number of assets that failed to load or timed out */
  const [failedCount, setFailedCount] = useState(0);

  /** Loading progress percentage (0-100) calculated from counts */
  const [progress, setProgress] = useState(0);

  /** Whether all assets have finished loading (success + failure = total) */
  const [isComplete, setIsComplete] = useState(false);

  // ===== REFS FOR OPTIMIZATION =====

  /** Prevents duplicate scanning during React strict mode or component re-renders */
  const hasScanned = useRef(false);

  /** Accumulates total asset count across all scanner types */
  const totalAssets = useRef(0);

  /**
   * Asset Detection and Scanning Phase
   *
   * Runs once on component mount to:
   * 1. Parse configuration options with sensible defaults
   * 2. Conditionally run each asset scanner based on user preferences
   * 3. Accumulate total asset counts from all active scanners
   * 4. Initialize the progress tracking system
   */
  useEffect(() => {
    // Prevent double-scanning during React strict mode or re-renders
    if (hasScanned.current) {
      return;
    }
    hasScanned.current = true;

    // Parse options with defaults: scan everything, ignore nothing
    const { scan = "all", ignore = [] } = options || {};

    // ===== IMAGE SCANNING =====
    const shouldScanImages =
      (scan === "all" || scan.includes("images")) && !ignore.includes("images");
    if (shouldScanImages) {
      /**
       * Detect and track all <img> elements on the page
       * Uses document.images for efficient native detection
       */
      const { totalImages } = scanImages(setLoadedCount, setFailedCount);
      totalAssets.current += totalImages;
    }

    // ===== VIDEO SCANNING =====
    const shouldScanVideos =
      (scan === "all" || scan.includes("videos")) && !ignore.includes("videos");
    if (shouldScanVideos) {
      /**
       * Detect and track all <video> elements with timeout protection
       * Monitors readyState and handles loading/error events
       */
      const { totalVideos } = scanVideos(setLoadedCount, setFailedCount);
      totalAssets.current += totalVideos;
    }

    // ===== AUDIO SCANNING =====
    const shouldScanAudios =
      (scan === "all" || scan.includes("audios")) && !ignore.includes("audios");
    if (shouldScanAudios) {
      /**
       * Detect and track all <audio> elements with timeout protection
       * Similar to video scanning but optimized for audio-specific states
       */
      const { totalAudios } = scanAudios(setLoadedCount, setFailedCount);
      totalAssets.current += totalAudios;
    }

    // ===== FONT SCANNING =====
    const shouldScanFonts =
      (scan === "all" || scan.includes("fonts")) && !ignore.includes("fonts");
    if (shouldScanFonts) {
      /**
       * Detect and track all web fonts using FontFace API
       * Handles @font-face declarations, Google Fonts, and custom fonts
       */
      const { totalFonts } = scanFonts(setLoadedCount, setFailedCount);
      totalAssets.current += totalFonts;
    }

    // Initialize total count to trigger progress calculations
    setTotalCount(totalAssets.current);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - run once on mount only

  /**
   * Progress Calculation and Completion Detection
   *
   * Recalculates progress percentage and completion status whenever
   * asset counts change. This provides real-time feedback as assets
   * finish loading or fail.
   */
  useEffect(() => {
    // Only calculate if we have assets to track
    if (totalCount > 0) {
      // Calculate progress: (completed assets / total assets) * 100
      // Completed = successfully loaded + failed (both count as "finished")
      const newProgress = ((loadedCount + failedCount) / totalCount) * 100;
      setProgress(newProgress);

      // Check completion: all assets have finished (either loaded or failed)
      const allAssetsFinished = loadedCount + failedCount === totalCount;
      setIsComplete(allAssetsFinished);
    }
  }, [loadedCount, failedCount, totalCount]); // Recalculate when any count changes

  return {
    totalCount,
    loadedCount,
    failedCount,
    progress,
    isComplete,
  };
}
