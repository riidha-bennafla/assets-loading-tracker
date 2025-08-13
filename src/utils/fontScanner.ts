import { Dispatch, SetStateAction } from "react";

/**
 * Automatically detects and tracks loading progress of web fonts on the page
 *
 * This scanner monitors fonts declared via @font-face, Google Fonts, Adobe Fonts, and other web fonts.
 * It does NOT track system fonts (Arial, Times New Roman, etc.) as they don't require loading time.
 *
 * **Key Features:**
 * - Automatic detection of all declared web fonts using the document.fonts API
 * - Real-time tracking of fonts in all loading states (loaded, loading, error, unloaded)
 * - 7-second timeout protection prevents stuck progress on problematic fonts
 * - Counts all declared fonts as assets, regardless of usage status
 *
 * **Font Loading States Handled:**
 * - `loaded`: Font successfully downloaded and ready → Count immediately as loaded
 * - `loading`: Font currently downloading → Wait with timeout protection, then update counts
 * - `error`: Font failed to load → Count immediately as failed
 * - `unloaded`: Font declared but not yet activated → Count as loaded (available for use)
 *
 * **Timeout Protection:**
 * Uses Promise.race() with a 7-second timeout to handle fonts that get stuck in loading state.
 * This prevents the progress tracker from never reaching 100% due to network issues or corrupted fonts.
 *
 * **Performance Considerations:**
 * - Scans once when initialized to detect all declared fonts
 * - Uses efficient FontFace API promises for minimal performance impact
 * - Handles up to hundreds of font variants without blocking the main thread
 *
 * @param setLoadedCount - React state setter function to increment the count of successfully loaded fonts
 * @param setFailedCount - React state setter function to increment the count of failed fonts
 *
 * @returns Object containing the total number of fonts detected and being tracked
 *
 * @example
 * ```typescript
 * // Usage within asset loading system
 * const { totalFonts } = scanFonts(
 *   (count) => setLoadedCount(prev => prev + count),
 *   (count) => setFailedCount(prev => prev + count)
 * );
 * console.log(`Tracking ${totalFonts} web fonts`);
 * ```
 *
 * @example
 * ```typescript
 * // Typical font detection results
 * // Page with Google Fonts + custom fonts:
 * // - Roboto Regular, Bold, Italic (3 fonts)
 * // - Custom Brand Font Light, Regular (2 fonts)
 * // - Total: 5 fonts tracked
 * ```
 *
 * @since 1.1.0
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/FontFace} FontFace API Documentation
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Document/fonts} document.fonts Documentation
 */
export function scanFonts(
  setLoadedCount: Dispatch<SetStateAction<number>>,
  setFailedCount: Dispatch<SetStateAction<number>>
): { totalFonts: number } {
  // Convert FontFaceSet to array for efficient iteration
  const fonts = Array.from(document.fonts);
  let totalFonts = 0;

  // Process each declared font based on its current loading state
  fonts.forEach((font) => {
    if (font.status === "loaded") {
      // Font has already finished loading successfully
      // This typically happens with cached fonts on subsequent page loads
      setLoadedCount((prev) => prev + 1);
      totalFonts++;
    } else if (font.status === "error") {
      // Font has already failed to load (network error, invalid file, etc.)
      setFailedCount((prev) => prev + 1);
      totalFonts++;
    } else if (font.status === "unloaded") {
      // Font is declared (via @font-face) but not yet activated by CSS usage
      // We count these as "loaded" since they're available and don't need download time
      // This prevents intermittent 0-count issues when fonts haven't been activated yet
      setLoadedCount((prev) => prev + 1);
      totalFonts++;
      return;
    } else if (font.status === "loading") {
      // Font is currently downloading - set up promise-based tracking with timeout protection
      totalFonts++;

      // Use the FontFace API's built-in promise that resolves when loading completes
      // Convert both success and failure cases to predictable string results
      const fontPromise = font.loaded.then(
        () => "loaded", // Font downloaded successfully
        () => "failed" // Font failed to download (network error, CORS, invalid file)
      );

      // Create timeout promise to prevent indefinite waiting (7 seconds)
      // This handles edge cases like network timeouts or corrupted font files
      const timeoutPromise = new Promise<"failed">((resolve) =>
        setTimeout(() => resolve("failed"), 7000)
      );

      // Race between actual font loading and timeout
      // Whichever completes first determines the result
      Promise.race([fontPromise, timeoutPromise]).then((result) => {
        if (result === "loaded") {
          // Font loaded successfully within the timeout period
          setLoadedCount((prev) => prev + 1);
        } else {
          // Font either failed to load or timed out after 7 seconds
          setFailedCount((prev) => prev + 1);
        }
      });
    }
  });

  return { totalFonts };
}
