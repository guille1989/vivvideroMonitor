const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const logger = require('../utils/logger');

puppeteer.use(StealthPlugin());

function buildAllLanguagesUrl(profileUrl) {
  const url = new URL(profileUrl);
  url.searchParams.set('languages', 'all');
  return url.toString();
}

async function withRetry(fn, maxAttempts = 3, baseDelayMs = 3000) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * attempt;
        logger.warn(`Scraping attempt ${attempt} failed: ${err.message}. Retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

/**
 * Scrapea perfil de Trustpilot y extrae resumen del negocio + reseñas visibles.
 *
 * @param {string} profileUrl
 * @returns {Promise<{businessData: {businessName: string, rating: number, trustScore: string|null, totalReviews: number}, reviews: Array}>}
 */
async function scrapeTrustpilot(profileUrl) {
  return withRetry(async () => {
    let browser;

    try {
      const targetUrl = buildAllLanguagesUrl(profileUrl);

      logger.info(`Iniciando scraping Trustpilot: ${targetUrl}`);

      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1366, height: 900 });
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
      );

      await page.goto(targetUrl, {
        waitUntil: 'networkidle2',
        timeout: 45000,
      });

      await new Promise((r) => setTimeout(r, 1800));

      const businessData = await page.evaluate(() => {
        const getText = (el) => (el?.textContent || '').trim();
        const parseFloatFromText = (value) => {
          const normalized = String(value || '').replace(',', '.');
          const match = normalized.match(/([1-5](?:\.\d)?)/);
          const parsed = match ? parseFloat(match[1]) : 0;
          return Number.isFinite(parsed) ? parsed : 0;
        };
        const parseIntFromText = (value) => {
          const digits = String(value || '').replace(/[^\d]/g, '');
          return digits ? parseInt(digits, 10) : 0;
        };
        const parseJsonSafely = (raw) => {
          try {
            return JSON.parse(raw);
          } catch (_err) {
            return null;
          }
        };
        const collectNodes = (root) => {
          if (!root) return [];
          if (Array.isArray(root)) return root.flatMap((item) => collectNodes(item));
          if (typeof root !== 'object') return [];
          const current = [root];
          if (Array.isArray(root['@graph'])) {
            return current.concat(root['@graph'].flatMap((item) => collectNodes(item)));
          }
          if (root['@graph'] && typeof root['@graph'] === 'object') {
            return current.concat(collectNodes(root['@graph']));
          }
          return current;
        };
        const jsonLdNodes = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
          .map((script) => parseJsonSafely(script.textContent || ''))
          .filter(Boolean)
          .flatMap((payload) => collectNodes(payload));
        const aggregateNode = jsonLdNodes.find((node) => {
          const ratingValue = node?.aggregateRating?.ratingValue;
          const reviewCount = node?.aggregateRating?.reviewCount;
          return ratingValue || reviewCount;
        });

        // businessName
        let businessName =
          aggregateNode?.name ||
          getText(document.querySelector('h1[class*="title"]')) ||
          getText(document.querySelector('h1')) ||
          'Negocio sin nombre';
        businessName = businessName.replace(/\s*Reviews?\s*\d+\s*$/i, '').trim() || businessName;

        // rating (1-5)
        let rating = parseFloatFromText(aggregateNode?.aggregateRating?.ratingValue);
        const ratingTypography = document.querySelector('span[data-rating-typography]');
        if (!rating && ratingTypography) {
          rating = parseFloatFromText(getText(ratingTypography));
        }

        if (!rating) {
          const ratingValueCandidate = Array.from(
            document.querySelectorAll('[class*="ratingValue"], [class*="RatingValue"]')
          )
            .map((el) => parseFloatFromText(getText(el)))
            .find((n) => n >= 1 && n <= 5);
          rating = ratingValueCandidate || 0;
        }

        if (!rating) {
          const hero = document.querySelector('[class*="hero"]');
          if (hero) {
            const heroSpanRating = Array.from(hero.querySelectorAll('span'))
              .map((el) => parseFloatFromText(getText(el)))
              .find((n) => n >= 1 && n <= 5);
            rating = heroSpanRating || 0;
          }
        }

        // trustScore label
        let trustScore =
          getText(document.querySelector('[class*="trustScore"] [class*="typography"]')) ||
          getText(document.querySelector('[data-score-label]')) ||
          '';

        if (!trustScore) {
          const hero = document.querySelector('[class*="hero"]');
          if (hero) {
            const labelRegex = /(Excellent|Great|Good|Average|Bad)/i;
            const matchedLabel = Array.from(hero.querySelectorAll('*'))
              .map((el) => getText(el))
              .find((txt) => labelRegex.test(txt));
            trustScore = matchedLabel || '';
          }
        }

        if (!rating) {
          const trustScoreNumeric = parseFloatFromText(
            getText(document.querySelector('[class*="trustScore"]'))
          );
          rating = trustScoreNumeric || 0;
        }

        // totalReviews
        let totalReviews = parseIntFromText(aggregateNode?.aggregateRating?.reviewCount);
        if (!totalReviews) {
          totalReviews = parseIntFromText(
          getText(document.querySelector('[data-reviews-count-typography]'))
          );
        }

        if (!totalReviews) {
          const reviewCountCandidate = Array.from(document.querySelectorAll('[class*="reviewsCount"]'))
            .map((el) => getText(el))
            .find(Boolean);
          totalReviews = parseIntFromText(reviewCountCandidate);
        }

        return {
          businessName,
          rating,
          trustScore: trustScore || null,
          totalReviews,
        };
      });

      const reviews = await page.evaluate(() => {
        const getText = (el) => (el?.textContent || '').trim();
        const parseDigit = (value) => {
          const match = String(value || '').match(/([1-5])/);
          return match ? Number(match[1]) : 0;
        };
        const getAuthorPhotoUrl = (card) => {
          const avatarImg =
            card.querySelector('[class*="consumerInfoWrapper"] img[src*="user-images.trustpilot.com"]') ||
            card.querySelector('img[src*="user-images.trustpilot.com"]') ||
            card.querySelector('img[width="44"]:not([alt*="Rated"])');

          const src = avatarImg?.getAttribute('src') || null;
          if (!src) return null;
          if (/stars?-/i.test(src) || /brand-assets/i.test(src)) return null;
          return src;
        };

        const reviewsRoot = document.querySelector('[data-reviews-overview-section]') || document;
        let cards = Array.from(reviewsRoot.querySelectorAll('article[data-service-review-card-paper="true"]'));
        if (cards.length === 0) {
          cards = Array.from(reviewsRoot.querySelectorAll('article[class*="review"]'));
        }
        if (cards.length === 0) {
          cards = Array.from(reviewsRoot.querySelectorAll('[class*="reviewCard"]'));
        }
        if (cards.length === 0) {
          cards = Array.from(reviewsRoot.querySelectorAll('div[data-service-review-id]'));
        }

        return cards
          .map((card) => {
            const authorName =
              getText(card.querySelector('[class*="consumerName"] span')) ||
              getText(card.querySelector('[class*="consumer-information"] span')) ||
              getText(card.querySelector('[data-consumer-name-typography]')) ||
              '';

            let rating = 0;
            const ratedImageAlt = card.querySelector('img[alt*="Rated"]')?.getAttribute('alt');
            if (ratedImageAlt) {
              rating = parseDigit(ratedImageAlt);
            }

            if (!rating) {
              rating = parseDigit(card.getAttribute('data-service-review-rating'));
            }

            if (!rating) {
              const starsTitle = getText(card.querySelector('[class*="stars"] svg title'));
              rating = parseDigit(starsTitle);
            }

            const reviewTitle =
              getText(card.querySelector('[data-service-review-title-typography]')) ||
              getText(card.querySelector('h2')) ||
              '';
            const reviewBody =
              getText(card.querySelector('[data-service-review-text-typography]')) ||
              getText(card.querySelector('p[class*="reviewContent"]')) ||
              getText(card.querySelector('[class*="reviewBody"] p')) ||
              '';
            const reviewText = [reviewTitle, reviewBody].filter(Boolean).join('\n\n');

            let reviewTimestamp = null;
            let relativeTimeDescription = null;

            const timeEl = card.querySelector('time[datetime]');
            if (timeEl) {
              reviewTimestamp = timeEl.getAttribute('datetime') || null;
            }

            if (!reviewTimestamp) {
              const reviewDateText = getText(card.querySelector('[class*="reviewDate"]'));
              relativeTimeDescription = reviewDateText || null;
            }

            return {
              reviewId: card.getAttribute('data-service-review-id') || null,
              authorName,
              authorPhotoUrl: getAuthorPhotoUrl(card),
              rating,
              text: reviewText,
              reviewTimestamp,
              relativeTimeDescription,
            };
          })
          .filter((review) => review.authorName && review.rating > 0);
      });

      logger.success(`Scraping Trustpilot completado: ${reviews.length} reseñas detectadas.`);

      return {
        businessData,
        reviews,
      };
    } catch (error) {
      logger.error(`Error en scrapeTrustpilot: ${error.message}`);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }, 3, 3000);
}

module.exports = {
  scrapeTrustpilot,
  withRetry,
};
