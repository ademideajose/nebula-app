import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
  type Session,
  type AdminApiContext,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { restResources } from "@shopify/shopify-api/rest/admin/2025-01";
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
  restResources,
  future: {
    //unstable_newEmbeddedAuthStrategy: true,
    //removeRest: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),

    afterAuth: async ({ session, admin }: { session: Session; admin: AdminApiContext}) => {
      const { shop } = session;
  console.log("🔁 afterAuth triggered for shop:", shop);

  try {
    if (!admin.rest?.resources?.ScriptTag) {
      console.error("❌ REST resources not available");
      return;
    }

    // 1. Check existing script tags
    const existingTagsResponse = await admin.rest.resources.ScriptTag.all({ session });
    const existingTags = existingTagsResponse.data || [];
    const existing = existingTags.find((tag: any) =>
      tag.src && tag.src.includes("inject-agent-link.js")
    );

    if (existing) {
      console.log("✅ Script tag already injected.");
      return;
    }

    // 2. Create new script tag
    const scriptTag = new admin.rest.resources.ScriptTag({session});
    scriptTag.event = "onload";
    scriptTag.src = "https://nebula-app-snhd.onrender.com/inject-agent-link.js";
    
    await scriptTag.save({
      update: true,
    });

    console.log("🎯 Script tag injected:", scriptTag.id);
  } catch (error: any) {
    console.error("❌ Failed to inject script tag:", error?.response?.errors || error.message);
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
