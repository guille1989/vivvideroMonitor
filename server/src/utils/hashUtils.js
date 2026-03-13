const crypto = require('crypto');

/**
 * Genera un hash MD5 para deduplicar resenas.
 * Usa un identificador estable cuando existe (timestamp/reviewId) y
 * conserva el texto como apoyo para reducir colisiones.
 *
 * @param {string} authorName
 * @param {string|number} timeKey
 * @param {string} text
 * @returns {string} hash hex
 */
function generateReviewHash(authorName, timeKey, text) {
  const raw = `${authorName || ''}::${timeKey || ''}::${(text || '').substring(0, 100)}`;
  return crypto.createHash('md5').update(raw).digest('hex');
}

module.exports = { generateReviewHash };
