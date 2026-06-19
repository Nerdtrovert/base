const normalizeBaseUrl = (value: string) => value.replace(/\/$/, '');

export const getApiBaseUrl = (): string => {
  if (typeof window === 'undefined') {
    return 'http://localhost:5001';
  }

  const configuredUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (configuredUrl && configuredUrl.trim()) {
    return normalizeBaseUrl(configuredUrl.trim());
  }

  const { hostname, origin, protocol } = window.location;

  if (hostname.includes('devtunnels.ms')) {
    return origin.replace('-5173', '-5001');
  }

  if (hostname.includes('onrender.com') || protocol === 'https:') {
    return origin;
  }

  return `http://${hostname}:5001`;
};

export const BACKEND_URL = getApiBaseUrl();

