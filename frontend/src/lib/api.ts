const normalizeBaseUrl = (value: string) => value.replace(/\/$/, '');

export const getApiBaseUrl = (): string => {
  if (typeof window === 'undefined') {
    return 'http://localhost:5001';
  }

  const { hostname, origin, protocol } = window.location;

  // In production (Render, or any production HTTPS site), we route API requests
  // through the frontend origin using Render's rewrite rules to avoid cross-site cookie blocking.
  if (hostname.includes('onrender.com') || protocol === 'https:') {
    return origin;
  }

  const configuredUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (configuredUrl && configuredUrl.trim()) {
    return normalizeBaseUrl(configuredUrl.trim());
  }

  if (hostname.includes('devtunnels.ms')) {
    return origin.replace('-5173', '-5001');
  }

  return `http://${hostname}:5001`;
};

export const BACKEND_URL = getApiBaseUrl();

