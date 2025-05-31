/* global Shopify */

(function () {
  // ---------- helpers ----------
  function getShopDomain() {
    console.log('[Agentic Debug] Shopify object:', typeof Shopify !== 'undefined' ? Shopify : 'undefined');
    
    if (typeof Shopify !== 'undefined' && Shopify.shop) {
      console.log('[Agentic Debug] Found Shopify.shop:', Shopify.shop);
      return Shopify.shop;
    }

    // Fallback 1 – theme liquid has <meta name="shopify-shop-domain">
    const meta = document.querySelector('meta[name="shopify-shop-domain"]');
    console.log('[Agentic Debug] Meta tag:', meta);
    if (meta && meta.content) {
      console.log('[Agentic Debug] Found meta content:', meta.content);
      return meta.content;
    }

    // Fallback 2 – current hostname looks like *.myshopify.com
    console.log('[Agentic Debug] Current hostname:', location.hostname);
    if (location.hostname.endsWith('.myshopify.com')) {
      console.log('[Agentic Debug] Using hostname as shop:', location.hostname);
      return location.hostname;
    }

    console.warn('[Agentic] Unable to determine shop domain—discovery link not injected.');
    console.log('[Agentic Debug] Final fallback - no shop found');
    return null;
  }

  function prettyStoreName(domain) {
    return domain
      .split('.')[0]
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  }

  // ---------- main ----------
  console.log('[Agentic Debug] Script starting...');
  
  if (document.querySelector('link[rel="agent-api"]')) {
    console.log('[Agentic Debug] Agent API link already exists, exiting');
    return;
  }

  const shop = getShopDomain();
  console.log('[Agentic Debug] Detected shop:', shop);
  
  if (!shop) {
    console.log('[Agentic Debug] No shop detected, exiting');
    return;
  }

  const link = document.createElement('link');
  link.rel = 'agent-api';
  link.type = 'application/vnd.openapi+json;version=3.0';
  link.href =
    'https://agentic-commerce-api.onrender.com/agent-api/.well-known/agent-commerce-openapi.json?shop=' +
    encodeURIComponent(shop);
  link.title = `${prettyStoreName(shop)} Agent Commerce API`;

  console.log('[Agentic Debug] Created link:', link.href);
  document.head.appendChild(link);
  console.log('[Agentic Debug] Link injected successfully');
})();