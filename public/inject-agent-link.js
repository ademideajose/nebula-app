/* global Shopify */

(function () {
  // ---------- helpers ----------
  function getShopDomain() {
    if (typeof Shopify !== 'undefined' && Shopify.shop) return Shopify.shop;

    // Fallback 1 – theme liquid has <meta name="shopify-shop-domain">
    const meta = document.querySelector(
      'meta[name="shopify-shop-domain"]'
    );
    if (meta && meta.content) return meta.content;

    // Fallback 2 – current hostname looks like *.myshopify.com
    if (location.hostname.endsWith('.myshopify.com'))
      return location.hostname;

    console.warn(
      '[Agentic] Unable to determine shop domain—discovery link not injected.'
    );
    return null;
  }

  function prettyStoreName(domain) {
    return domain
      .split('.')[0]
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  }

  // ---------- main ----------
  if (document.querySelector('link[rel="agent-api"]')) return;

  const shop = getShopDomain();
  if (!shop) return; // can’t safely inject

  const link = document.createElement('link');
  link.rel = 'agent-api';
  link.type = 'application/vnd.openapi+json;version=3.0';
  link.href =
    'https://agentic-commerce-api.onrender.com/.well-known/agent-commerce-openapi.json?shop=' +
    encodeURIComponent(shop);
  link.title = `${prettyStoreName(shop)} Agent Commerce API`;

  document.head.appendChild(link);
})();
