/**
 * URL parameter utilities for reading query strings
 */

export function getUrlParam(key: string): string | null {
  if (typeof window === 'undefined') return null;
  
  const params = new URLSearchParams(window.location.search);
  return params.get(key);
}

export function hasUrlParam(key: string, value?: string): boolean {
  const paramValue = getUrlParam(key);
  if (paramValue === null) return false;
  if (value === undefined) return true;
  return paramValue === value;
}
