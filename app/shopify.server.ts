// app/shopify.server.ts (Shopify Nebula App)
import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
  type Session, // Used in afterAuth
  type AdminApiContext, // Used in afterAuth
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { restResources } from "@shopify/shopify-api/rest/admin/2025-01"; // Using specific API version
import prisma from "./db.server"; // Your Prisma client for the Nebula app's session storage

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.January25,
  scopes: process.env.SCOPES?.split(","), // <<< 1. SCOPES DEFINITION
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore, // Assuming App Store distribution eventually
  isEmbeddedApp: true, // Ensures embedded app flow, usually handles offline token for install
  restResources,
  future: {
    //unstable_newEmbeddedAuthStrategy: true,
    //removeRest: true, // If you enable this, admin.rest.resources.ScriptTag might not be available. Be cautious.
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
  hooks: {
    afterAuth: async ({ session, admin }: { session: Session; admin: AdminApiContext}) => {
      const { shop } = session; // shop is available from session
      shopify.registerWebhooks({ session }); // Good practice
      console.log("🔁 afterAuth triggered for shop:", shop);

      // ----- NOTIFY NESTJS API (AGENTIC-COMMERCE-API) -----
      // This is the part that passes the token and scopes
      // The `session` object from `afterAuth` should contain the offline token and granted scopes.
      if (session.shop && session.accessToken && session.scope) {
        console.log(`🔑 Passing token to NestJS API for ${session.shop}. Scopes: ${session.scope}. Token (first 10 chars): ${session.accessToken.substring(0,10)}...`);
        try {
          const nestJsApiUrl = process.env.NESTJS_API_URL; // <<< 3. NESTJS_API_URL from .env
          if (!nestJsApiUrl) {
            console.error("❌ NESTJS_API_URL not configured in Shopify app's .env. Cannot notify NestJS API.");
            return; // Exit if URL not set
          }

          // The target endpoint in your NestJS API
          const initEndpoint = `${nestJsApiUrl}/agent-api/auth/shopify/init`;
          // NEW VERSION (improved with conditional logic):
          const frontendDomain = session.shop.replace(/-v\d+/, '');

          // Only send frontendDomain if it's different from backend domain
          const shouldSendMapping = frontendDomain !== session.shop;

          console.log(`📞 Calling NestJS init endpoint: ${initEndpoint}`);
          console.log(`🔗 Backend domain: ${session.shop}, Frontend domain: ${frontendDomain}`);

          // Build the payload object step by step
          const payload: {
            shop: string;
            accessToken: string;
            scopes: string;
            frontendDomain?: string; // Optional property
          } = {
            shop: session.shop,
            accessToken: session.accessToken,
            scopes: session.scope
          };

          // Only add frontendDomain if it's different
          if (shouldSendMapping) {
            payload.frontendDomain = frontendDomain;
          }

          const response = await fetch(initEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            const errorBody = await response.text(); // Get more details on error
            console.error(
              `❌ Error initializing NestJS API for shop ${session.shop}: ${response.status} ${response.statusText}`,
              `Response body: ${errorBody}`
            );
          } else {
            const responseData = await response.json();
            console.log(`✅ NestJS API init response for ${session.shop}:`, responseData.message);
          }
        } catch (error: any) { // Catch network errors etc. for the fetch call
          console.error(`❌ Failed to call NestJS API for shop ${session.shop}:`, error.message, error.stack);
        }
      } else {
        // Log missing parts of the session
        let missingParts = [];
        if (!session.shop) missingParts.push("shop");
        if (!session.accessToken) missingParts.push("accessToken");
        if (!session.scope) missingParts.push("scope");
        console.error(`❌ Missing essential session data (${missingParts.join(", ")}) after auth for shop ${session.shop || 'unknown'}. Cannot init NestJS API.`);
      }
      // ----- END NOTIFY NESTJS API -----
    },
  },
});

export default shopify;
// Export other necessary parts from shopifyApp object
export const apiVersion = ApiVersion.January25; // Correctly use shopify.config.apiVersion
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage; // Access session storage if needed