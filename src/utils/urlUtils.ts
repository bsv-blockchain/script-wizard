/**
 * Utility functions for encoding/decoding scripts in URLs for sharing.
 *
 * Three URL modes:
 *   1. TXID lookup:   ?txid=<hex>&vin=<n>           (on-chain tx, fetched via WoC)
 *   2. Manual BEEF:   ?beef=<hex>&vin=<n>            (off-chain tx, full BEEF in URL)
 *   3. Manual scripts: ?unlock=<b64>&lock=<b64>      (no BEEF, raw ASM)
 */

export interface ScriptParams {
  unlock?: string;
  lock?: string;
  txid?: string;
  beef?: string;
  vin?: number;
  network?: string;
}

/**
 * Encodes a script string to base64 for URL usage
 */
export const encodeScriptForUrl = (script: string): string => {
  try {
    return btoa(unescape(encodeURIComponent(script)));
  } catch (error) {
    console.error('Failed to encode script for URL:', error);
    return '';
  }
};

/**
 * Decodes a base64 script string from URL
 */
export const decodeScriptFromUrl = (encoded: string): string => {
  try {
    return decodeURIComponent(escape(atob(encoded)));
  } catch (error) {
    console.error('Failed to decode script from URL:', error);
    return '';
  }
};

/**
 * Parses URL parameters to extract script data
 */
export const parseScriptParamsFromUrl = (): ScriptParams => {
  const urlParams = new URLSearchParams(window.location.search);
  const params: ScriptParams = {};

  const txidParam = urlParams.get('txid');
  const beefParam = urlParams.get('beef');
  const vinParam = urlParams.get('vin');
  const networkParam = urlParams.get('network');

  if (networkParam) {
    params.network = networkParam;
  }

  if (txidParam) {
    params.txid = txidParam;
    params.vin = vinParam ? parseInt(vinParam, 10) : 0;
    return params;
  }

  if (beefParam) {
    params.beef = beefParam;
    params.vin = vinParam ? parseInt(vinParam, 10) : 0;
    return params;
  }

  const unlockParam = urlParams.get('unlock');
  const lockParam = urlParams.get('lock');

  if (unlockParam) {
    params.unlock = decodeScriptFromUrl(unlockParam);
  }

  if (lockParam) {
    params.lock = decodeScriptFromUrl(lockParam);
  }

  return params;
};

/**
 * Generates a shareable URL with the appropriate parameters.
 */
interface UrlOpts {
  lookupTxid?: string;
  beefHex?: string;
  beefInputIndex?: number;
  unlockingScript?: string;
  lockingScript?: string;
  network?: string;
}

const buildParams = (opts: UrlOpts): URLSearchParams => {
  const params = new URLSearchParams();

  if (opts.network && opts.network !== 'main') {
    params.set('network', opts.network);
  }

  if (opts.lookupTxid?.trim()) {
    params.set('txid', opts.lookupTxid.trim());
    if (opts.beefInputIndex != null && opts.beefInputIndex > 0) {
      params.set('vin', String(opts.beefInputIndex));
    }
  } else if (opts.beefHex?.trim()) {
    params.set('beef', opts.beefHex.trim());
    if (opts.beefInputIndex != null && opts.beefInputIndex > 0) {
      params.set('vin', String(opts.beefInputIndex));
    }
  } else {
    if (opts.unlockingScript?.trim()) {
      params.set('unlock', encodeScriptForUrl(opts.unlockingScript));
    }
    if (opts.lockingScript?.trim()) {
      params.set('lock', encodeScriptForUrl(opts.lockingScript));
    }
  }

  return params;
};

export const generateShareableUrl = (opts: UrlOpts): string => {
  const baseUrl = window.location.origin + window.location.pathname;
  const params = buildParams(opts);
  return params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
};

/**
 * Updates the current URL without page reload.
 */
export const updateUrlWithScripts = (opts: UrlOpts): void => {
  const params = buildParams(opts);
  const newUrl = params.toString()
    ? `${window.location.pathname}?${params.toString()}`
    : window.location.pathname;
  window.history.replaceState({}, '', newUrl);
};
