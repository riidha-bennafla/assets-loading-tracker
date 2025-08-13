import { Dispatch, SetStateAction } from "react";

/**
 * Automatically detects and tracks loading progress of video elements on the page
 *
 * This scanner provides comprehensive monitoring of all `<video>` elements in the DOM,
 * handling various video formats, loading states, and network conditions. It includes
 * advanced timeout protection to ensure progress tracking never gets stuck on problematic
 * video sources, making it perfect for asset-heavy applications and media galleries.
 *
 * **Key Features:**
 * - **Automatic Detection**: Uses `document.querySelectorAll('video')` for complete coverage
 * - **Intelligent State Tracking**: Monitors HTML5 video readyState for accurate progress
 * - **Timeout Protection**: 7-second failsafe prevents stuck progress on broken videos
 * - **Concurrent Loading**: Handles multiple videos loading simultaneously without conflicts
 * - **Error Resilience**: Failed/timed-out videos don't prevent overall completion
 *
 * **Video Loading Process:**
 * 1. **Detection Phase**: Scans DOM for all `<video>` elements regardless of source
 * 2. **State Assessment**: Checks each video's current readyState (0-4 scale)
 * 3. **Event Monitoring**: Sets up listeners for videos still loading
 * 4. **Timeout Racing**: Races actual loading against 7-second timeout
 * 5. **State Updates**: Updates parent component state as videos complete or fail
 *
 * **HTML5 Video readyState Reference:**
 * - `0` **HAVE_NOTHING** - No video data available
 * - `1` **HAVE_METADATA** - Video metadata loaded (duration, dimensions, etc.)
 * - `2` **HAVE_CURRENT_DATA** - Current frame data available
 * - `3` **HAVE_FUTURE_DATA** - Enough data for immediate playback
 * - `4` **HAVE_ENOUGH_DATA** - Sufficient data for uninterrupted playback
 *
 * **Timeout Protection Rationale:**
 * The 7-second timeout handles real-world edge cases that can break asset loading:
 * - **Malformed Sources**: `<source>` tags with invalid URLs that never error
 * - **Network Timeouts**: Slow connections that hang without failing
 * - **CORS Issues**: Cross-origin videos that silently fail to load
 * - **Corrupted Files**: Videos with damaged headers that confuse browsers
 * - **Server Issues**: Temporary server problems causing indefinite loading
 *
 * **Performance Considerations:**
 * - **Memory Efficient**: Uses `{ once: true }` event listeners to prevent memory leaks
 * - **Non-blocking**: Asynchronous processing doesn't impact page rendering
 * - **Scalable**: Handles dozens of videos without performance degradation
 * - **Resource Aware**: Timeout prevents infinite resource consumption
 *
 * @param setLoadedCount - React state setter to increment successful video load count
 * @param setFailedCount - React state setter to increment failed video load count
 *
 * @returns Object containing the total number of video elements detected
 * @returns returns.totalVideos - Count of all `<video>` elements found on the page
 *
 * @example
 * ```typescript
 * // Basic integration with React state management
 * function VideoTracker() {
 *   const [loadedCount, setLoadedCount] = useState(0);
 *   const [failedCount, setFailedCount] = useState(0);
 *
 *   const { totalVideos } = scanVideos(setLoadedCount, setFailedCount);
 *
 *   return (
 *     <div>
 *       Videos: {loadedCount} loaded, {failedCount} failed of {totalVideos} total
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Usage within asset loading system
 * useEffect(() => {
 *   const { totalVideos } = scanVideos(
 *     (count) => setTotalLoaded(prev => prev + count),
 *     (count) => setTotalFailed(prev => prev + count)
 *   );
 *   setTotalAssets(prev => prev + totalVideos);
 * }, []);
 * ```
 *
 * @example
 * ```html
 * <!-- All these video types are automatically detected -->
 * <!-- Single source video -->
 * <video src="presentation.mp4" controls></video>
 *
 * <!-- Multi-source video with fallbacks -->
 * <video controls preload="metadata">
 *   <source src="demo.webm" type="video/webm">
 *   <source src="demo.mp4" type="video/mp4">
 *   <source src="demo.ogv" type="video/ogg">
 * </video>
 *
 * <!-- Background video (common in modern web design) -->
 * <video autoplay muted loop>
 *   <source src="hero-background.mp4" type="video/mp4">
 * </video>
 *
 * <!-- Even problematic videos won't block overall progress -->
 * <video controls>
 *   <source src="https://broken-cdn.com/missing-video.mp4" type="video/mp4">
 * </video>
 * ```
 *
 * @example
 * ```typescript
 * // Real-world usage patterns and expected results
 *
 * // Scenario 1: Fast-loading cached videos
 * // Result: Immediate "loaded" state for readyState >= 4 videos
 *
 * // Scenario 2: Large videos on slow connections
 * // Result: Proper event-based tracking until canplay or 7s timeout
 *
 * // Scenario 3: Broken video URLs
 * // Result: Either immediate error event or 7s timeout → marked as failed
 *
 * // Scenario 4: Mixed video states
 * // Result: Each video tracked independently, progress updates in real-time
 * ```
 *
 * **Browser Compatibility:**
 * - **Modern browsers**: Full support (Chrome 4+, Firefox 3.5+, Safari 4+, Edge 12+)
 * - **HTML5 Video API**: Uses standard readyState and event APIs
 * - **Promise support**: Requires ES6 Promise support (polyfill available for older browsers)
 *
 * @since 1.1.0
 * @author Ridha Bennafla <https://github.com/riidha-bennafla>
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/readyState} HTML5 Video readyState
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video} HTML Video Element
 */
export function scanVideos(
  setLoadedCount: Dispatch<SetStateAction<number>>,
  setFailedCount: Dispatch<SetStateAction<number>>
): { totalVideos: number } {
  // Convert NodeList to Array for modern JavaScript array methods
  const videos = Array.from(document.querySelectorAll("video"));
  const totalVideos = videos.length;

  /**
   * Create individual Promise races for each video element
   *
   * This approach ensures that:
   * - Each video is tracked independently
   * - One slow/broken video doesn't affect others
   * - Concurrent loading is properly handled
   * - State updates happen as videos complete individually
   */
  const videoPromises = videos.map((video) => {
    /**
     * Primary loading promise: Natural video loading progression
     *
     * Monitors the video's natural loading process through HTML5 media events
     * and readyState progression. This represents the "happy path" where videos
     * load successfully within reasonable timeframes.
     */
    const videoLoadingPromise = new Promise<"loaded" | "failed">((resolve) => {
      /**
       * Fast path: Check if video is already sufficiently loaded
       *
       * readyState >= 4 (HAVE_ENOUGH_DATA) indicates the browser has downloaded
       * enough video data to play through to completion without buffering.
       * This commonly occurs with:
       * - Cached videos from previous page visits
       * - Small video files that load very quickly
       * - Videos with aggressive preloading (preload="auto")
       */
      if (video.readyState >= 4) {
        resolve("loaded");
        return;
      }

      /**
       * Slow path: Set up event listeners for videos still loading
       *
       * For videos not yet fully buffered (readyState 0-3), we monitor
       * HTML5 media events to detect when they become playable or encounter errors.
       */

      /**
       * Success event: 'canplay'
       * Fires when the browser can start playing the video, even if not fully downloaded.
       * This is the most reliable indicator that a video is "ready" for user interaction.
       */
      video.addEventListener("canplay", () => resolve("loaded"), {
        once: true,
      });

      /**
       * Failure event: 'error'
       * Fires when video loading encounters an error such as:
       * - 404 Not Found (missing video file)
       * - Network connectivity issues
       * - Unsupported video format/codec
       * - CORS (Cross-Origin Resource Sharing) violations
       * - Corrupted video file data
       */
      video.addEventListener("error", () => resolve("failed"), { once: true });
    });

    /**
     * Timeout promise: Failsafe for problematic videos
     *
     * Critical for preventing progress tracking from getting permanently stuck.
     * After 7 seconds, automatically marks the video as "failed" regardless of
     * its actual loading state. This timeout duration is chosen based on:
     *
     * - **User Experience**: 7s is the maximum users will typically wait
     * - **Network Realities**: Most video loading issues surface within 5-7 seconds
     * - **Browser Behavior**: Some browser bugs never trigger error events
     * - **Performance Impact**: Prevents indefinite resource consumption
     */
    const timeoutPromise = new Promise<"loaded" | "failed">((resolve) =>
      setTimeout(() => resolve("failed"), 7000)
    );

    /**
     * Promise.race(): First resolution wins
     *
     * This creates a race condition between:
     * 1. Natural video loading (success or error events)
     * 2. 7-second timeout (automatic failure)
     *
     * Whichever Promise resolves first determines the final result,
     * ensuring every video eventually reaches a concluded state.
     */
    return Promise.race([videoLoadingPromise, timeoutPromise]);
  });

  /**
   * Handle promise resolutions and update React state
   *
   * Each video promise resolves independently as its loading completes,
   * fails, or times out. This enables real-time progress updates as
   * individual videos finish loading.
   */
  videoPromises.forEach((videoPromise) => {
    videoPromise.then((result) => {
      if (result === "loaded") {
        /**
         * Success case: Video became playable within timeout period
         *
         * Uses functional state update for thread-safe concurrent modifications.
         * This prevents race conditions when multiple videos complete simultaneously.
         */
        setLoadedCount((previousCount) => previousCount + 1);
      } else {
        /**
         * Failure case: Video failed to load or exceeded timeout
         *
         * Both natural failures (network errors, format issues) and timeout failures
         * count toward completion to ensure progress tracking always reaches 100%.
         * This prevents stuck loading states that frustrate users.
         */
        setFailedCount((previousCount) => previousCount + 1);
      }
    });
  });

  /**
   * Return immediate scan results
   *
   * The total count is available synchronously to initialize progress tracking,
   * while individual video loading continues asynchronously in the background.
   */
  return {
    /**
     * Total number of video elements detected via DOM query
     *
     * This represents the complete scope of videos being tracked,
     * including those that may eventually timeout or fail to load.
     */
    totalVideos,
  };
}
