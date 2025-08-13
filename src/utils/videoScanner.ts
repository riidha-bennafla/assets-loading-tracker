/**
 * Automatically scans and tracks all video elements on the current page
 *
 * This function provides automatic detection and progress tracking for all `<video>` elements
 * in the DOM. It handles videos in different loading states and includes timeout protection
 * to prevent progress tracking from getting stuck on problematic videos.
 *
 * **How it works:**
 * 1. Scans all videos using `document.querySelectorAll('video')`
 * 2. For fully buffered videos: Immediately marks as loaded (readyState >= 4)
 * 3. For loading videos: Sets up event listeners to track completion
 * 4. Applies 7-second timeout to prevent stuck videos from blocking progress
 * 5. Updates React state in real-time as videos become playable, fail, or timeout
 *
 * **Video readyState values:**
 * - `0` HAVE_NOTHING - No data loaded
 * - `1` HAVE_METADATA - Basic video info loaded
 * - `2` HAVE_CURRENT_DATA - Current frame loaded
 * - `3` HAVE_FUTURE_DATA - Enough data for immediate playbook
 * - `4` HAVE_ENOUGH_DATA - Enough data to play through completely
 *
 * **Timeout Protection:**
 * Videos that don't load or fail within 7 seconds are automatically marked as "failed"
 * to ensure progress tracking always reaches 100%. This handles edge cases like:
 * - Corrupted video sources that never trigger error events
 * - Network timeouts that leave videos in pending state
 * - Malformed `<source>` elements with invalid URLs
 *
 * @param setLoadedCount - React state setter function to increment successful video loads
 * @param setFailedCount - React state setter function to increment failed video loads
 *
 * @returns Object containing the total number of videos found
 * @returns returns.totalVideos - Total count of `<video>` elements detected on the page
 *
 * @example
 * ```typescript
 * // Basic usage in a React hook
 * const [loadedCount, setLoadedCount] = useState(0);
 * const [failedCount, setFailedCount] = useState(0);
 *
 * const { totalVideos } = scanVideos(setLoadedCount, setFailedCount);
 * console.log(`Found ${totalVideos} videos to track`);
 * ```
 *
 * @example
 * ```typescript
 * // The state setters will be called automatically as videos load or timeout:
 * // - setLoadedCount(prev => prev + 1) for each video that becomes playable
 * // - setFailedCount(prev => prev + 1) for each video that fails or times out after 7s
 * ```
 *
 * @example
 * ```html
 * <!-- These video elements will be automatically detected -->
 * <video src="intro.mp4" controls></video>
 * <video preload="auto">
 *   <source src="demo.webm" type="video/webm">
 *   <source src="demo.mp4" type="video/mp4">
 * </video>
 * <!-- Even problematic videos won't block progress -->
 * <video>
 *   <source src="http://broken-url.com/video.mp4" type="video/mp4">
 * </video>
 * ```
 *
 * @since 1.1.0
 * @author Ridha Bennafla <https://github.com/riidha-bennafla>
 */

export function scanVideos(
  setLoadedCount: React.Dispatch<React.SetStateAction<number>>,
  setFailedCount: React.Dispatch<React.SetStateAction<number>>
): { totalVideos: number } {
  // Convert NodeList to Array for easier manipulation
  const videos = Array.from(document.querySelectorAll("video"));
  const totalVideos = videos.length;

  /**
   * Create a Promise race for each video between loading completion and timeout
   * Each video gets its own race to prevent one slow/broken video from affecting others
   */
  const loadVideos = videos.map((video) => {
    /**
     * Primary promise: Track natural video loading progression
     * Resolves when the video becomes playable or encounters an error
     */
    const videoPromise = new Promise<"loaded" | "failed">((resolve) => {
      /**
       * Check if video has enough data to play through
       * readyState >= 4 (HAVE_ENOUGH_DATA) means the video is ready for smooth playback
       */
      if (video.readyState >= 4) {
        resolve("loaded");
      } else {
        /**
         * For videos still loading (readyState 0-3), set up event listeners:
         * - 'canplay': Video has enough data to start playing (but may need to buffer during playback)
         * - 'error': Video failed to load (network error, unsupported format, etc.)
         * - { once: true }: Automatically remove listeners after first trigger to prevent memory leaks
         */
        video.addEventListener("canplay", () => resolve("loaded"), {
          once: true,
        });
        video.addEventListener("error", () => resolve("failed"), {
          once: true,
        });
      }
    });

    /**
     * Timeout promise: Fail-safe mechanism for problematic videos
     *
     * After 7 seconds, automatically resolves to "failed" to prevent progress tracking
     * from getting stuck on videos that never load or fail naturally.
     *
     * This handles edge cases like:
     * - Videos with malformed <source> elements that don't trigger error events
     * - Network timeouts that leave videos in perpetual loading state
     * - CORS issues that prevent proper error reporting
     * - Corrupted video files that confuse browser loading mechanisms
     */
    const timeoutPromise = new Promise<"loaded" | "failed">((resolve) =>
      setTimeout(() => resolve("failed"), 7000)
    );

    /**
     * Promise.race(): Whichever resolves first (loading or timeout) wins
     * This ensures every video eventually resolves, preventing infinite loading states
     */
    return Promise.race([videoPromise, timeoutPromise]);
  });

  /**
   * Handle promise resolutions and update React state
   * Each promise resolves independently as its corresponding video loads, fails, or times out
   */
  loadVideos.forEach((loadVideo) => {
    loadVideo.then((result) => {
      if (result === "loaded") {
        /**
         * Use functional state update to safely handle concurrent updates
         * This prevents race conditions when multiple videos load simultaneously
         */
        setLoadedCount((prev) => prev + 1);
      } else {
        /**
         * Handle failed videos including:
         * - Natural failures (network errors, unsupported formats, CORS issues)
         * - Timeout failures (videos that took longer than 7 seconds)
         * Both count toward progress completion to ensure 100% is always reachable
         */
        setFailedCount((prev) => prev + 1);
      }
    });
  });

  // Return immediate scan results
  return {
    /**
     * Total number of <video> elements found via document.querySelectorAll('video')
     * This represents the complete scope of videos to be tracked, including those that may timeout
     */
    totalVideos,
  };
}
