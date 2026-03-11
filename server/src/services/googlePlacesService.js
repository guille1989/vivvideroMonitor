const axios = require('axios');
const logger = require('../utils/logger');

const PLACES_BASE_URL = 'https://maps.googleapis.com/maps/api/place';

/**
 * Obtiene los detalles del negocio + reviews desde Google Places API.
 *
 * @param {string} placeId - Google Place ID
 * @returns {Promise<{name, rating, userRatingsTotal, reviews}>}
 */
async function fetchPlaceDetails(placeId) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    throw new Error('GOOGLE_PLACES_API_KEY no está configurada en .env');
  }

  const url = `${PLACES_BASE_URL}/details/json`;

  const params = {
    place_id: placeId,
    fields: [
      'name',
      'rating',
      'user_ratings_total',
      'reviews',
      'formatted_address',
    ].join(','),
    language: 'es',
    reviews_sort: 'newest',
    key: apiKey,
  };

  logger.info(`Consultando Google Places API para placeId: ${placeId}`);

  const response = await axios.get(url, { params, timeout: 10000 });

  const { status, result, error_message } = response.data;

  if (status !== 'OK') {
    throw new Error(`Google Places API error [${status}]: ${error_message || 'Sin detalles'}`);
  }

  if (!result) {
    throw new Error('Google Places API devolvió resultado vacío');
  }

  return {
    name: result.name || 'Negocio sin nombre',
    rating: result.rating || 0,
    userRatingsTotal: result.user_ratings_total || 0,
    address: result.formatted_address || '',
    reviews: result.reviews || [],
  };
}

module.exports = { fetchPlaceDetails };
