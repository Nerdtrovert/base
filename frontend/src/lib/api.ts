const normalizeBaseUrl = (value: string) => value.replace(/\/$/, '');

export const getApiBaseUrl = (): string => {
  if (typeof window === 'undefined') {
    return 'http://localhost:5001';
  }

  const configuredUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (configuredUrl && configuredUrl.trim()) {
    return normalizeBaseUrl(configuredUrl.trim());
  }

  const { hostname, origin } = window.location;

  if (hostname.endsWith('onrender.com') || window.location.protocol === 'https:') {
    return normalizeBaseUrl(origin);
  }

  if (hostname.includes('devtunnels.ms')) {
    return origin.replace('-5173', '-5001');
  }

  if (hostname.includes('localhost') || hostname === '127.0.0.1') {
    return 'http://localhost:5001';
  }

  return `http://${hostname}:5001`;
};

export const BACKEND_URL = getApiBaseUrl();
