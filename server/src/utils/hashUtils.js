const crypto = require('crypto');

/**
 * Genera un hash MD5 para deduplicar reseñas.
 * Usa: authorName + relativeTimeDescription + primeros 100 chars del texto
 *
 * @param {string} authorName
 * @param {string} relativeTime
 * @param {string} text
 * @returns {string} hash hex
 */
function generateReviewHash(authorName, relativeTime, text) {
  const raw = `${authorName}::${relativeTime}::${(text || '').substring(0, 100)}`;
  return crypto.createHash('md5').update(raw).digest('hex');
}

module.exports = { generateReviewHash };
