import { QRContext } from './types';

/**
 * Parse QR code URL parameters to extract context
 * QR codes should be in format: /?branch=xxx&zone=yyy&table=zzz
 */
export const parseQRContext = (searchParams: URLSearchParams): QRContext => {
  return {
    branchId: searchParams.get('branch') || undefined,
    zoneId: searchParams.get('zone') || undefined,
    tableId: searchParams.get('table') || undefined,
  };
};

export const getQRContextFromURL = (): QRContext => {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  return parseQRContext(params);
};

export const buildURLWithContext = (path: string, context: QRContext): string => {
  const url = new URL(path, window.location.origin);
  if (context.branchId) url.searchParams.set('branch', context.branchId);
  if (context.zoneId) url.searchParams.set('zone', context.zoneId);
  if (context.tableId) url.searchParams.set('table', context.tableId);
  return url.pathname + url.search;
};

export const storeQRContext = (context: QRContext): void => {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem('qrContext', JSON.stringify(context));
};

export const getStoredQRContext = (): QRContext | null => {
  if (typeof window === 'undefined') return null;
  const stored = sessionStorage.getItem('qrContext');
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
};

export const getQRContext = (): QRContext => {
  const urlContext = getQRContextFromURL();
  if (Object.keys(urlContext).length > 0) {
    storeQRContext(urlContext);
    return urlContext;
  }
  return getStoredQRContext() || {};
};

