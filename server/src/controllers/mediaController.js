const axios = require('axios');

const ALLOWED_HOST_SUFFIXES = [
  'googleusercontent.com',
  'user-images.trustpilot.com',
];

function isAllowedAvatarHost(hostname) {
  return ALLOWED_HOST_SUFFIXES.some(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`)
  );
}

async function proxyAvatar(req, res) {
  const { url } = req.query;

  if (typeof url !== 'string' || !url) {
    return res.status(400).json({ error: 'url es requerida' });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch (_error) {
    return res.status(400).json({ error: 'url invalida' });
  }

  if (parsedUrl.protocol !== 'https:' || !isAllowedAvatarHost(parsedUrl.hostname)) {
    return res.status(400).json({ error: 'host de avatar no permitido' });
  }

  try {
    const upstream = await axios.get(parsedUrl.toString(), {
      responseType: 'arraybuffer',
      timeout: 10000,
      maxRedirects: 0,
    });

    res.setHeader('Content-Type', upstream.headers['content-type'] || 'application/octet-stream');
    res.setHeader('Cache-Control', upstream.headers['cache-control'] || 'public, max-age=86400');

    if (upstream.headers['content-length']) {
      res.setHeader('Content-Length', upstream.headers['content-length']);
    }

    return res.send(Buffer.from(upstream.data));
  } catch (error) {
    const status = error.response?.status;
    if (status === 404) {
      return res.status(404).json({ error: 'avatar no encontrado' });
    }
    return res.status(502).json({ error: 'no se pudo obtener el avatar remoto' });
  }
}

module.exports = {
  proxyAvatar,
};
