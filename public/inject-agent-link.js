// public/inject-agent-link.js
/* global Shopify */

(function() {
  // Function to reliably get the shop domain from the Shopify context
  function getShopDomain() {
    if (typeof Shopify !== 'undefined' && Shopify.shop) {
      return Shopify.shop;
    }
    // Fallback if Shopify global is not available or doesn't have shop property
    // This might happen on non-theme pages or if script loads too early.
    // Consider other ways to get shopDomain if this is unreliable.
    // For example, it could be embedded as a data attribute on the script tag itself.
    // For now, this is a common way:
    try {
        const shopMeta = document.querySelector('meta[name="shopify-shop-domain"]');
        if (shopMeta && shopMeta.content) {
            return shopMeta.content;
        }
    } catch(e) { /* ignore */ }

    // Fallback from window.location if it's a myshopify.com domain
    if (window.location.hostname.endsWith('.myshopify.com')) {
        return window.location.hostname;
    }
    
    // As a last resort, you might need to have the Shopify app pass this
    // when registering the script tag or embed it in the page.
    // For the example, let's assume Shopify.shop is available.
    // If not, the injection URL from shopify.server.ts might need to pass it
    // or the script source URL in shopify.server.ts itself could be dynamic with shop.
    console.warn("Could not reliably determine shop domain for Agent API link title.");
    return window.location.hostname; // Fallback, might not be the myshopify.com domain
  }

  const shopDomain = getShopDomain();
  const storeName = shopDomain.split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); // Simple beautification

  const link = document.createElement('link');
  link.rel = 'agent-api';
  link.type = 'application/vnd.openapi+json;version=3.0'; // CHANGED
  // IMPORTANT: Replace 'nebula-app-snhd.onrender.com' with the actual domain where your NestJS API (agentic-commerce-api) is hosted
  // and ensure it serves the OpenAPI spec at the '/.well-known/agent-commerce-openapi.json' path.
  link.href = `https://agentic-commerce-api.onrender.com/.well-known/agent-commerce-openapi.json`; // CHANGED
  link.title = `${storeName} Agent Commerce API`; // ADDED & CHANGED

  document.head.appendChild(link);
  console.log('Agent API link injected:', link.outerHTML);
})();