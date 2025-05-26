import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
  type Session,
  type AdminApiContext,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.January25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    //removeRest: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),

    afterAuth: async ({ session, admin, request }: { session: Session; admin: AdminApiContext; request: Request }) => {
      const { shop } = session;
      console.log("🔁 afterAuth triggered for shop:", shop);
      const host = request.headers.get("host");
      const protocol = host?.includes("localhost") ? "http" : "https";
      const dynamicAppUrl =
      host && !host.includes("localhost")
        ? `${protocol}://${host}`
        : process.env.SHOPIFY_APP_URL;
  try {
    const themes = await admin.rest.resources.Theme.all({ session });
    console.log("🎨 Themes fetched:", themes.data.map((t) => ({ id: t.id, name: t.name, role: t.role })));

    const mainTheme = themes.data.find((t) => t.role === "main");
    if (!mainTheme) {
      console.warn("⚠️ No main theme found");
      return;
    }

    const asset = await admin.rest.resources.Asset.find({
      session,
      theme_id: mainTheme.id,
      asset: { key: "layout/theme.liquid" },
    });
    const currentValue = asset.body.asset.value;

    const discoveryTag = `
<link rel="agent-api" type="application/json" href="${dynamicAppUrl}/agent-api/suggest?shop=${shop}" />
      `;

    if (currentValue.includes('rel="agent-api"')) {
      console.log("✅ Discovery tag already exists, skipping injection.");
      return;
    }

    const updatedValue = currentValue.replace("</head>", `${discoveryTag}\n</head>`);
    await admin.rest.resources.Asset.update({
      session,
      theme_id: mainTheme.id,
      asset: {
        key: "layout/theme.liquid",
        value: updatedValue,
      },
    });

    console.log("✅ Discovery tag injected successfully.");
  } catch (error) {
    console.error("❌ Theme injection failed:", error);
  }
},


});

export default shopify;
export const apiVersion = ApiVersion.January25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
