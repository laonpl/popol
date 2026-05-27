const PRODUCTION_API_URL = 'https://popol-vcdm.onrender.com/api';

export function getApiBaseUrl() {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');

  return import.meta.env.PROD ? PRODUCTION_API_URL : '/api';
}
