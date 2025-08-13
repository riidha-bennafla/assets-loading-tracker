/**
 * Automatically scans and tracks all audio elements on the current page
 *
 * This function provides automatic detection and progress tracking for all `<audio>` elements
 * in the DOM. It handles audio files in different loading states and includes timeout protection
 * to prevent progress tracking from getting stuck on problematic audio sources.
 *
 * **How it works:**
 * 1. Scans all audio elements using `document.querySelectorAll('audio')`
 * 2. For fully buffered audio: Immediately marks as loaded (readyState >= 4)
 * 3. For loading audio: Sets up event listeners to track completion
 * 4. Applies 7-second timeout to prevent stuck audio from blocking progress
 * 5. Updates React state in real-time as audio becomes playable, fails, or times out
 *
 * **Audio readyState values:**
 * - `0` HAVE_NOTHING - No data loaded
 * - `1` HAVE_METADATA - Basic audio info loaded (duration, sample rate, etc.)
 * - `2` HAVE_CURRENT_DATA - Current playback position data loaded
 * - `3` HAVE_FUTURE_DATA - Enough data for immediate playback
 * - `4` HAVE_ENOUGH_DATA - Enough data to play through completely without buffering
 *
 * **Timeout Protection:**
 * Audio files that don't load or fail within 7 seconds are automatically marked as "failed"
 * to ensure progress tracking always reaches 100%. This handles edge cases like:
 * - Corrupted audio files that never trigger error events
 * - Network timeouts that leave audio in pending state
 * - Malformed `<source>` elements with invalid URLs
 * - Audio codec issues that prevent proper loading
 *
 * @param setLoadedCount - React state setter function to increment successful audio loads
 * @param setFailedCount - React state setter function to increment failed audio loads
 *
 * @returns Object containing the total number of audio elements found
 * @returns returns.totalAudios - Total count of `<audio>` elements detected on the page
 *
 * @example
 * ```typescript
 * // Basic usage in a React hook
 * const [loadedCount, setLoadedCount] = useState(0);
 * const [failedCount, setFailedCount] = useState(0);
 *
 * const { totalAudios } = scanAudios(setLoadedCount, setFailedCount);
 * console.log(`Found ${totalAudios} audio files to track`);
 * ```
 *
 * @example
 * ```typescript
 * // The state setters will be called automatically as audio loads or times out:
 * // - setLoadedCount(prev => prev + 1) for each audio that becomes playable
 * // - setFailedCount(prev => prev + 1) for each audio that fails or times out after 7s
 * ```
 *
 * @example
 * ```html
 * <!-- These audio elements will be automatically detected -->
 * <audio src="background-music.mp3" controls></audio>
 * <audio preload="auto" loop>
 *   <source src="sound-effect.ogg" type="audio/ogg">
 *   <source src="sound-effect.mp3" type="audio/mpeg">
 * </audio>
 * <!-- Even problematic audio won't block progress -->
 * <audio>
 *   <source src="http://broken-url.com/audio.mp3" type="audio/mpeg">
 * </audio>
 * ```
 *
 * @since 1.1.0
 * @author Ridha Bennafla <https://github.com/riidha-bennafla>
 */

export function scanAudios(
  setLoadedCount: React.Dispatch<React.SetStateAction<number>>,
  setFailedCount: React.Dispatch<React.SetStateAction<number>>
): { totalAudios: number } {
  // Convert NodeList to Array for easier manipulation
  const audios = Array.from(document.querySelectorAll("audio"));
  const totalAudios = audios.length;

  /**
   * Create a Promise race for each audio file between loading completion and timeout
   * Each audio gets its own race to prevent one slow/broken file from affecting others
   */
  const loadAudios = audios.map((audio) => {
    /**
     * Primary promise: Track natural audio loading progression
     * Resolves when the audio becomes playable or encounters an error
     */
    const audioPromise = new Promise<"loaded" | "failed">((resolve) => {
      /**
       * Check if audio has enough data to play through completely
       * readyState >= 4 (HAVE_ENOUGH_DATA) means the audio is ready for smooth playback
       */
      if (audio.readyState >= 4) {
        resolve("loaded");
      } else {
        /**
         * For audio still loading (readyState 0-3), set up event listeners:
         * - 'canplay': Audio has enough data to start playing (but may need to buffer during playback)
         * - 'error': Audio failed to load (network error, unsupported codec, CORS issues, etc.)
         * - { once: true }: Automatically remove listeners after first trigger to prevent memory leaks
         */
        audio.addEventListener("canplay", () => resolve("loaded"), {
          once: true,
        });
        audio.addEventListener("error", () => resolve("failed"), {
          once: true,
        });
      }
    });

    /**
     * Timeout promise: Fail-safe mechanism for problematic audio files
     *
     * After 7 seconds, automatically resolves to "failed" to prevent progress tracking
     * from getting stuck on audio that never loads or fails naturally.
     *
     * This handles edge cases like:
     * - Audio files with malformed <source> elements that don't trigger error events
     * - Network timeouts that leave audio in perpetual loading state
     * - Codec compatibility issues that prevent proper error reporting
     * - Corrupted audio files that confuse browser loading mechanisms
     * - Large audio files on slow connections that exceed reasonable load times
     */
    const timeoutPromise = new Promise<"loaded" | "failed">((resolve) =>
      setTimeout(() => resolve("failed"), 7000)
    );

    /**
     * Promise.race(): Whichever resolves first (loading or timeout) wins
     * This ensures every audio file eventually resolves, preventing infinite loading states
     */
    return Promise.race([audioPromise, timeoutPromise]);
  });

  /**
   * Handle promise resolutions and update React state
   * Each promise resolves independently as its corresponding audio loads, fails, or times out
   */
  loadAudios.forEach((loadAudio) => {
    loadAudio.then((result) => {
      if (result === "loaded") {
        /**
         * Use functional state update to safely handle concurrent updates
         * This prevents race conditions when multiple audio files load simultaneously
         */
        setLoadedCount((prev) => prev + 1);
      } else {
        /**
         * Handle failed audio including:
         * - Natural failures (network errors, unsupported codecs, CORS issues)
         * - Timeout failures (audio that took longer than 7 seconds)
         * Both count toward progress completion to ensure 100% is always reachable
         */
        setFailedCount((prev) => prev + 1);
      }
    });
  });

  // Return immediate scan results
  return {
    /**
     * Total number of <audio> elements found via document.querySelectorAll('audio')
     * This represents the complete scope of audio files to be tracked, including those that may timeout
     */
    totalAudios,
  };
}
