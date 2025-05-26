import type { LoaderFunction } from "@remix-run/node";

export const loader: LoaderFunction = () => {
  const js = `
    (function() {
      const shopDomain = window.Shopify?.shop || window.location.hostname;
      const link = document.createElement('link');
      link.rel = 'agent-api';
      link.type = 'application/json';
      link.href = 'https://nebula-app-snhd.onrender.com/agent-api/suggest?shop=' + shopDomain;
      document.head.appendChild(link);
    })();
  `;

  return new Response(js, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=86400",
    },
  });
};
