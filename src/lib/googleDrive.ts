/**
 * Google Drive URL utilities
 * Converts Google Drive sharing links to direct image URLs
 */

/**
 * Extracts file ID from various Google Drive URL formats
 * Supports:
 * - https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 * - https://drive.google.com/open?id=FILE_ID
 * - https://drive.google.com/uc?id=FILE_ID&export=view
 * - https://docs.google.com/document/d/FILE_ID/edit
 */
export function extractGoogleDriveFileId(url: string): string | null {
  if (!url) return null

  // Match /d/FILE_ID/ pattern
  const dMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (dMatch) return dMatch[1]

  // Match id=FILE_ID pattern
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (idMatch) return idMatch[1]

  return null
}

/**
 * Converts a Google Drive URL to a direct image URL
 * Returns the original URL if it's not a Google Drive URL
 */
export function toGoogleDriveDirectUrl(url: string): string {
  if (!url) return url

  // If already a direct URL, return as-is
  if (url.includes('drive.google.com/uc?')) {
    return url
  }

  // If it's a Google Drive URL, convert it
  if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
    const fileId = extractGoogleDriveFileId(url)
    if (fileId) {
      return `https://drive.google.com/uc?export=view&id=${fileId}`
    }
  }

  // Return original URL for non-Google Drive URLs
  return url
}

/**
 * Checks if a URL is a Google Drive URL
 */
export function isGoogleDriveUrl(url: string): boolean {
  if (!url) return false
  return url.includes('drive.google.com') || url.includes('docs.google.com')
}

/**
 * Gets the thumbnail URL for a Google Drive file (smaller, faster loading)
 * Useful for list views
 */
export function toGoogleDriveThumbnailUrl(url: string, size: number = 200): string {
  const fileId = extractGoogleDriveFileId(url)
  if (fileId) {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`
  }
  return url
}
