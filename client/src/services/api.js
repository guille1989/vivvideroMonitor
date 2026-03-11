import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

/**
 * Obtiene el resumen del negocio.
 */
export async function fetchSummary(placeId) {
  const { data } = await api.get(`/business/${placeId}/summary`);
  return data;
}

/**
 * Obtiene reviews con filtros opcionales.
 *
 * @param {string} placeId
 * @param {object} filters - { rating, onlyNew, onlyNegative, includeRemoved, onlyRemoved, search, from, to, page, limit }
 */
export async function fetchReviews(placeId, filters = {}) {
  const params = {};
  if (filters.rating) params.rating = filters.rating;
  if (filters.onlyNew) params.onlyNew = 'true';
  if (filters.onlyNegative) params.onlyNegative = 'true';
  if (filters.includeRemoved) params.includeRemoved = 'true';
  if (filters.onlyRemoved) params.onlyRemoved = 'true';
  if (filters.search) params.search = filters.search;
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  params.page = filters.page || 1;
  params.limit = filters.limit || 20;

  const { data } = await api.get(`/business/${placeId}/reviews`, { params });
  return data;
}

/**
 * Obtiene métricas para gráficas.
 */
export async function fetchMetrics(placeId) {
  const { data } = await api.get(`/business/${placeId}/metrics`);
  return data;
}

/**
 * Dispara sincronización manual.
 */
export async function triggerSync(placeId) {
  const { data } = await api.post(`/business/${placeId}/sync`);
  return data;
}

/**
 * Health check del backend.
 */
export async function fetchHealth() {
  const { data } = await api.get('/health');
  return data;
}
