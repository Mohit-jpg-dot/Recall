/**
 * Recall Extension — Cross-Browser API Shim
 *
 * Normalizes extension runtime APIs across:
 * - Chrome (chrome.*)
 * - Firefox (browser.* or chrome.*)
 * - Safari (browser.* or chrome.*)
 */

export const browserAPI = (
  typeof (globalThis as any).browser !== 'undefined'
    ? (globalThis as any).browser
    : (globalThis as any).chrome
) as typeof chrome;

export function detectBrowserType(): 'chrome' | 'firefox' | 'safari' | 'brave' | 'edge' {
  const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '').toLowerCase();
  if (ua.includes('firefox')) return 'firefox';
  if (ua.includes('edg/')) return 'edge';
  if (typeof (navigator as any)?.brave !== 'undefined' || (ua.includes('chrome') && typeof (globalThis as any).brave !== 'undefined')) return 'brave';
  if (ua.includes('safari') && !ua.includes('chrome')) return 'safari';
  return 'chrome';
}
