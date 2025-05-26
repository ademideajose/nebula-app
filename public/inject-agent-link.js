// public/inject-agent-link.js
(function () {
    const shopDomain = window.Shopify?.shop || window.location.hostname;
  
    const link = document.createElement("link");
    link.rel = "agent-api";
    link.type = "application/json";
    link.href = `https://nebula-app-snhd.onrender.com/agent-api/suggest?shop=${shopDomain}`;
  
    document.head.appendChild(link);
  })();
  