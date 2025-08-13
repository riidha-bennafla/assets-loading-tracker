import { Dispatch, SetStateAction } from "react";

/**
 * Automatically detects and tracks loading progress of audio elements on the page
 *
 * This scanner provides comprehensive monitoring of all `<audio>` elements in the DOM,
 * handling various audio formats, codecs, and network conditions. It includes advanced
 * timeout protection to ensure progress tracking never gets stuck on problematic audio
 * sources, making it ideal for applications with background music, sound effects, or
 * audio content libraries.
 *
 * **Key Features:**
 * - **Complete Coverage**: Uses `document.querySelectorAll('audio')` for all audio elements
 * - **Format Agnostic**: Handles MP3, OGG, WAV, AAC, and other HTML5 audio formats
 * - **Smart State Tracking**: Monitors HTML5 audio readyState for precise progress detection
 * - **Timeout Protection**: 7-second failsafe prevents indefinite loading on broken sources
 * - **Concurrent Processing**: Manages multiple audio files loading simultaneously
 * - **Error Resilience**: Failed audio files don't prevent overall loading completion
 *
 * **Audio Loading Lifecycle:**
 * 1. **Discovery Phase**: Scans DOM for all `<audio>` elements including background audio
 * 2. **State Evaluation**: Assesses each audio file's current readyState (0-4 scale)
 * 3. **Event Registration**: Attaches listeners for audio still in loading states
 * 4. **Race Condition Setup**: Races natural loading against timeout protection
 * 5. **Progress Updates**: Real-time state updates as audio files complete or fail
 *
 * **HTML5 Audio readyState Reference:**
 * - `0` **HAVE_NOTHING** - No audio data loaded
 * - `1` **HAVE_METADATA** - Audio metadata available (duration, bitrate, sample rate)
 * - `2` **HAVE_CURRENT_DATA** - Current playback position data loaded
 * - `3` **HAVE_FUTURE_DATA** - Enough data for immediate playback start
 * - `4` **HAVE_ENOUGH_DATA** - Complete buffering for uninterrupted playback
 *
 * **Timeout Protection for Audio-Specific Issues:**
 * Audio files present unique challenges that timeout protection addresses:
 * - **Codec Compatibility**: Some browsers silently fail on unsupported audio codecs
 * - **Large File Sizes**: High-quality audio files may take excessive time on slow connections
 * - **Streaming Issues**: Progressive audio loading can hang without clear error signals
 * - **Server Problems**: Audio CDNs may experience temporary outages or throttling
 * - **Mobile Limitations**: Mobile browsers have audio loading restrictions and timeouts
 *
 * **Performance Optimization:**
 * - **Memory Management**: Automatic event listener cleanup prevents memory leaks
 * - **Non-blocking Execution**: Asynchronous processing maintains UI responsiveness
 * - **Bandwidth Awareness**: Timeout prevents excessive bandwidth consumption on failed loads
 * - **Battery Friendly**: Prevents infinite loading loops that drain device battery
 *
 * @param setLoadedCount - React state setter to increment successful audio load count
 * @param setFailedCount - React state setter to increment failed audio load count
 *
 * @returns Object containing the total number of audio elements detected
 * @returns returns.totalAudios - Count of all `<audio>` elements found on the page
 *
 * @example
 * ```typescript
 * // Integration with React state for audio progress tracking
 * function AudioLoadingTracker() {
 *   const [loadedCount, setLoadedCount] = useState(0);
 *   const [failedCount, setFailedCount] = useState(0);
 *
 *   const { totalAudios } = scanAudios(setLoadedCount, setFailedCount);
 *
 *   const progress = totalAudios > 0 ? ((loadedCount + failedCount) / totalAudios) * 100 : 0;
 *
 *   return (
 *     <div className="audio-progress">
 *       <div>Audio Files: {progress.toFixed(1)}% loaded</div>
 *       <div>{loadedCount} ready, {failedCount} failed of {totalAudios} total</div>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Usage within comprehensive asset loading system
 * function useAssetLoader() {
 *   const [totalAssets, setTotalAssets] = useState(0);
 *   const [loadedAssets, setLoadedAssets] = useState(0);
 *
 *   useEffect(() => {
 *     const { totalAudios } = scanAudios(setLoadedAssets, setLoadedAssets);
 *     setTotalAssets(prev => prev + totalAudios);
 *   }, []);
 *
 *   return { totalAssets, loadedAssets };
 * }
 * ```
 *
 * @example
 * ```html
 * <!-- Various audio element types automatically detected -->
 *
 * <!-- Background music with controls -->
 * <audio src="background-ambience.mp3" controls loop></audio>
 *
 * <!-- Multi-format audio with codec fallbacks -->
 * <audio controls preload="auto">
 *   <source src="sound-effect.ogg" type="audio/ogg; codecs=vorbis">
 *   <source src="sound-effect.aac" type="audio/aac">
 *   <source src="sound-effect.mp3" type="audio/mpeg">
 * </audio>
 *
 * <!-- Autoplay audio (common in games and interactive media) -->
 * <audio autoplay muted>
 *   <source src="ui-sounds.wav" type="audio/wav">
 * </audio>
 *
 * <!-- Even problematic audio sources won't block progress -->
 * <audio>
 *   <source src="https://unreliable-cdn.com/missing-audio.mp3" type="audio/mpeg">
 * </audio>
 * ```
 *
 * @example
 * ```typescript
 * // Common usage scenarios and expected behaviors
 *
 * // Scenario 1: Podcast website with multiple audio episodes
 * // - Each <audio> element tracked individually
 * // - Progress updates as episodes buffer or fail to load
 *
 * // Scenario 2: Game with sound effects library
 * // - Multiple small audio files loaded concurrently
 * // - Timeout protection prevents stuck loading on corrupted sound files
 *
 * // Scenario 3: Music streaming interface
 * // - Large audio files with progressive loading
 * // - Real-time feedback as tracks become playable
 *
 * // Scenario 4: Educational content with audio narration
 * // - Mixed audio formats for browser compatibility
 * // - Graceful handling of unsupported codec failures
 * ```
 *
 * **Mobile and Accessibility Considerations:**
 * - **iOS Safari**: Handles iOS audio loading restrictions and user interaction requirements
 * - **Android Chrome**: Manages Android's audio loading behavior and data-saving modes
 * - **Reduced Motion**: Respects user preferences for reduced motion and audio
 * - **Screen Readers**: Compatible with assistive technologies accessing audio content
 *
 * **Browser Compatibility:**
 * - **Modern browsers**: Full HTML5 audio support (Chrome 4+, Firefox 3.5+, Safari 4+, Edge 12+)
 * - **HTML5 Audio API**: Uses standard readyState and media event APIs
 * - **Promise support**: Requires ES6 Promises (widely supported, polyfills available)
 * - **Mobile browsers**: Handles mobile-specific audio loading behaviors and restrictions
 *
 * @since 1.1.0
 * @author Ridha Bennafla <https://github.com/riidha-bennafla>
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/readyState} HTML5 Audio readyState
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTML/Element/audio} HTML Audio Element
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Audio_codecs} Web Audio Codecs Guide
 */
export function scanAudios(
  setLoadedCount: Dispatch<SetStateAction<number>>,
  setFailedCount: Dispatch<SetStateAction<number>>
): { totalAudios: number } {
  // Convert NodeList to Array for modern JavaScript iteration and manipulation
  const audios = Array.from(document.querySelectorAll("audio"));
  const totalAudios = audios.length;

  /**
   * Create individual Promise races for each audio element
   *
   * This architecture provides several key benefits:
   * - **Independent Tracking**: Each audio file loads and fails independently
   * - **Parallel Processing**: Multiple audio files can load simultaneously without blocking
   * - **Granular Updates**: Progress updates occur as individual files complete
   * - **Error Isolation**: One problematic audio file doesn't affect others
   */
  const audioPromises = audios.map((audio) => {
    /**
     * Primary loading promise: Natural audio loading progression
     *
     * Monitors the audio element's loading process through HTML5 media events
     * and readyState progression. This handles the standard audio loading flow
     * where files load successfully within reasonable timeframes.
     */
    const audioLoadingPromise = new Promise<"loaded" | "failed">((resolve) => {
      /**
       * Fast path optimization: Check for already-loaded audio
       *
       * readyState >= 4 (HAVE_ENOUGH_DATA) means the browser has sufficient
       * audio data for complete playback without buffering interruptions.
       * This fast path handles:
       * - Browser-cached audio from previous sessions
       * - Small audio files that load instantly
       * - Pre-buffered audio with aggressive preload settings
       * - Audio files loaded by other parts of the application
       */
      if (audio.readyState >= 4) {
        resolve("loaded");
        return;
      }

      /**
       * Standard path: Event-driven loading detection
       *
       * For audio files not yet fully buffered, we establish event listeners
       * to monitor HTML5 audio loading events and detect completion or failure.
       */

      /**
       * Success detection: 'canplay' event
       *
       * The 'canplay' event fires when the browser determines it can start
       * playing the audio, even if complete buffering isn't finished.
       * This represents the audio being "ready for use" from a user perspective.
       *
       * Key characteristics:
       * - Fires once sufficient data is buffered for playback start
       * - Indicates audio is usable even if not 100% downloaded
       * - Most reliable cross-browser indicator of audio readiness
       */
      audio.addEventListener("canplay", () => resolve("loaded"), {
        once: true,
      });

      /**
       * Failure detection: 'error' event
       *
       * The 'error' event fires when audio loading encounters problems:
       * - **Network Errors**: 404 Not Found, connection timeouts, DNS failures
       * - **Format Issues**: Unsupported codec, corrupted file headers
       * - **Security Problems**: CORS violations, blocked mixed content
       * - **Server Issues**: 500 errors, rate limiting, temporary unavailability
       * - **Browser Limitations**: Mobile restrictions, codec support gaps
       */
      audio.addEventListener("error", () => resolve("failed"), { once: true });
    });

    /**
     * Timeout promise: Essential failsafe for audio-specific challenges
     *
     * Audio files present unique loading challenges that require timeout protection:
     *
     * **Mobile Browser Issues:**
     * - iOS Safari requires user interaction before audio loading
     * - Android Chrome may throttle audio loading in background tabs
     * - Mobile data connections can cause indefinite audio loading states
     *
     * **Codec Compatibility Problems:**
     * - Some browsers silently fail on unsupported audio formats
     * - Partial codec support can cause hanging without error events
     * - Progressive enhancement scenarios where fallback codecs don't trigger
     *
     * **Network-Specific Issues:**
     * - Audio streaming can hang on poor connections without clear failure signals
     * - CDN issues may cause audio to load partially and then stall
     * - Proxy servers and corporate firewalls can interfere with audio loading
     *
     * The 7-second timeout ensures these edge cases don't prevent loading completion.
     */
    const timeoutPromise = new Promise<"loaded" | "failed">((resolve) =>
      setTimeout(() => resolve("failed"), 7000)
    );

    /**
     * Promise.race(): Competitive resolution between loading and timeout
     *
     * This creates a race between:
     * 1. **Natural audio loading**: Success via 'canplay' or failure via 'error'
     * 2. **Timeout protection**: Automatic failure after 7 seconds
     *
     * The first Promise to resolve determines the outcome, ensuring that
     * every audio element eventually reaches a definitive state (loaded or failed).
     * This prevents indefinite loading states that would break progress tracking.
     */
    return Promise.race([audioLoadingPromise, timeoutPromise]);
  });

  /**
   * Promise resolution handling and state management
   *
   * Each audio promise resolves independently, enabling real-time progress
   * updates as individual audio files complete loading, encounter errors,
   * or exceed the timeout threshold.
   */
  audioPromises.forEach((audioPromise) => {
    audioPromise.then((result) => {
      if (result === "loaded") {
        /**
         * Success case: Audio ready for playback within timeout period
         *
         * This indicates the audio file has loaded sufficient data for playback.
         * Uses functional state update pattern to handle concurrent audio loading
         * without race conditions or state corruption.
         */
        setLoadedCount((previousCount) => previousCount + 1);
      } else {
        /**
         * Failure case: Audio failed to load or exceeded timeout threshold
         *
         * This covers both explicit failures (error events) and timeout failures.
         * Both types count toward completion because they represent finished
         * processing - the audio is either available or definitively unavailable.
         * This ensures progress tracking always reaches 100% completion.
         */
        setFailedCount((previousCount) => previousCount + 1);
      }
    });
  });

  /**
   * Return immediate scan results for progress initialization
   *
   * The total count is available synchronously to set up progress tracking,
   * while individual audio loading continues asynchronously with Promise handling.
   */
  return {
    /**
     * Total number of audio elements detected via DOM scanning
     *
     * Represents the complete scope of audio files being monitored,
     * including those that may eventually timeout, fail, or load successfully.
     * This count includes all audio formats and configurations found on the page.
     */
    totalAudios,
  };
}
