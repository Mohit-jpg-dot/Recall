/**
 * Recall Extension — Privacy Filter
 *
 * Filters out excluded domains and sensitive URLs
 * before they enter the queue.
 */

// Default sensitive domains suggested during setup
const DEFAULT_SENSITIVE_PATTERNS = [
  // Banking
  'bank', 'chase.com', 'wellsfargo.com', 'bankofamerica.com',
  // Email
  'mail.google.com', 'outlook.live.com', 'mail.yahoo.com',
  // Healthcare
  'mychart.com', 'patient.',
  // Government
  '.gov',
  // Password managers
  'vault.bitwarden.com', '1password.com', 'lastpass.com',
  // Internal browser pages
  'chrome://', 'chrome-extension://', 'about:', 'edge://',
  'moz-extension://',
];

/**
 * Check if a URL should be excluded from collection.
 */
export function shouldExclude(
  url: string,
  domain: string,
  excludedDomains: string[]
): boolean {
  // Skip non-http(s) URLs
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return true;
  }

  // Skip empty/new tab pages
  if (url === 'about:blank' || url === 'chrome://newtab/') {
    return true;
  }

  // Check user's excluded domains
  for (const excluded of excludedDomains) {
    if (domain === excluded || domain.endsWith('.' + excluded)) {
      return true;
    }
  }

  return false;
}

/**
 * Extract domain from URL.
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * Extract search query from a URL if it's a search engine.
 */
export function extractSearchQuery(url: string): { query: string; engine: string } | null {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;

    const searchEngines: Record<string, { pattern: string; param: string }> = {
      google: { pattern: 'google.com', param: 'q' },
      bing: { pattern: 'bing.com', param: 'q' },
      duckduckgo: { pattern: 'duckduckgo.com', param: 'q' },
      yahoo: { pattern: 'search.yahoo.com', param: 'p' },
      youtube: { pattern: 'youtube.com', param: 'search_query' },
    };

    for (const [engine, config] of Object.entries(searchEngines)) {
      if (hostname.includes(config.pattern)) {
        const query = parsed.searchParams.get(config.param);
        if (query) {
          return { query, engine };
        }
      }
    }
  } catch {
    // Invalid URL
  }

  return null;
}
