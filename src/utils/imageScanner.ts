/**
 * Automatically scans and tracks all images on the current page
 *
 * This function provides automatic detection and progress tracking for all `<img>` elements
 * in the DOM. It handles both already-loaded images and images still in the loading process.
 *
 * **How it works:**
 * 1. Scans all images using `document.images`
 * 2. For completed images: Immediately determines success/failure using `naturalWidth`
 * 3. For loading images: Sets up event listeners to track completion
 * 4. Updates React state in real-time as images load or fail
 *
 * @param setLoadedCount - React state setter function to increment successful image loads
 * @param setFailedCount - React state setter function to increment failed image loads
 *
 * @returns Object containing the total number of images found
 * @returns returns.totalImages - Total count of `<img>` elements detected on the page
 *
 * @example
 * ```typescript
 * // Basic usage in a React hook
 * const [loadedCount, setLoadedCount] = useState(0);
 * const [failedCount, setFailedCount] = useState(0);
 *
 * const { totalImages } = scanImages(setLoadedCount, setFailedCount);
 * console.log(`Found ${totalImages} images to track`);
 * ```
 *
 * @example
 * ```typescript
 * // The state setters will be called automatically as images load:
 * // - setLoadedCount(prev => prev + 1) for each successful load
 * // - setFailedCount(prev => prev + 1) for each failed load
 * ```
 *
 * @since 1.1.0
 * @author Ridha Bennafla <https://github.com/riidha-bennafla>
 */

export function scanImages(
  setLoadedCount: React.Dispatch<React.SetStateAction<number>>,
  setFailedCount: React.Dispatch<React.SetStateAction<number>>
): { totalImages: number } {
  // Convert HTMLCollection to Array for easier manipulation
  const images = Array.from(document.images);
  const totalImages = images.length;

  /**
   * Create a Promise for each image to track its loading state
   * Each promise resolves to either "loaded" or "failed" based on the image's final state
   */
  const loadImages = images.map(
    (image) =>
      new Promise<"loaded" | "failed">((resolve) => {
        // Check if image has already completed loading
        if (image.complete) {
          /**
           * Smart success detection:
           * - image.complete = true doesn't guarantee success
           * - image.naturalWidth > 0 means the image actually loaded successfully
           * - image.naturalWidth = 0 means the image failed to load (broken/404)
           */
          resolve(image.naturalWidth > 0 ? "loaded" : "failed");
        } else {
          /**
           * For images still loading, set up event listeners:
           * - 'load': Image loaded successfully
           * - 'error': Image failed to load (404, network error, etc.)
           * - { once: true }: Automatically remove listeners after first trigger
           */
          image.addEventListener("load", () => resolve("loaded"), {
            once: true,
          });
          image.addEventListener("error", () => resolve("failed"), {
            once: true,
          });
        }
      })
  );

  /**
   * Handle promise resolutions and update React state
   * Each promise resolves independently as its corresponding image loads/fails
   */
  loadImages.forEach((loadImage) => {
    loadImage.then((result) => {
      if (result === "loaded") {
        /**
         * Use functional state update to safely handle concurrent updates
         * This prevents race conditions when multiple images load simultaneously
         */
        setLoadedCount((prev) => prev + 1);
      } else {
        // Handle failed images (404, network errors, invalid formats, etc.)
        setFailedCount((prev) => prev + 1);
      }
    });
  });

  // Return immediate scan results
  return {
    /**
     * Total number of <img> elements found in document.images
     * This represents the complete scope of images to be tracked
     */
    totalImages,
  };
}
