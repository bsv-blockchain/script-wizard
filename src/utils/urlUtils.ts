/**
 * Utility functions for encoding/decoding scripts in URLs for sharing
 */

export interface ScriptParams {
  unlock?: string;
  lock?: string;
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
 * Generates a shareable URL with encoded scripts
 */
export const generateShareableUrl = (unlockingScript: string, lockingScript: string): string => {
  const baseUrl = window.location.origin + window.location.pathname;
  const params = new URLSearchParams();
  
  if (unlockingScript.trim()) {
    params.set('unlock', encodeScriptForUrl(unlockingScript));
  }
  
  if (lockingScript.trim()) {
    params.set('lock', encodeScriptForUrl(lockingScript));
  }
  
  return params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
};

/**
 * Updates the current URL with script parameters without page reload
 */
export const updateUrlWithScripts = (unlockingScript: string, lockingScript: string): void => {
  const params = new URLSearchParams();
  
  if (unlockingScript.trim()) {
    params.set('unlock', encodeScriptForUrl(unlockingScript));
  }
  
  if (lockingScript.trim()) {
    params.set('lock', encodeScriptForUrl(lockingScript));
  }
  
  const newUrl = params.toString() 
    ? `${window.location.pathname}?${params.toString()}`
    : window.location.pathname;
    
  window.history.replaceState({}, '', newUrl);
};
