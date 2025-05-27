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

      // ----- SCRIPT TAG INJECTION LOGIC -----
      try {
        // Ensure admin context and ScriptTag resource are available
        if (!admin || !admin.rest || !admin.rest.resources || !admin.rest.resources.ScriptTag) {
          console.error("❌ Admin REST resources or ScriptTag not available in afterAuth context. Cannot manage script tags.");
        } else {
          const scriptTagService = new admin.rest.resources.ScriptTag({ session }); // Use the passed session
          const existingTagsResponse = await scriptTagService.all(); // Fetch all script tags for the session
          const existingTags = existingTagsResponse.data || [];
          const nebulaScriptTag = existingTags.find((tag: any) => // Use 'any' or a proper ScriptTag type
            tag.src && tag.src.includes("inject-agent-link.js")
          );

          const expectedScriptUrl = `${process.env.SHOPIFY_APP_URL}/inject-agent-link.js`; // Use env var for app URL

          if (nebulaScriptTag) {
            console.log(`✅ Script tag already injected with src: ${nebulaScriptTag.src}. Expected: ${expectedScriptUrl}`);
            if (nebulaScriptTag.src !== expectedScriptUrl) {
              console.warn(`⚠️ Script tag src mismatch. Deleting old tag and re-injecting.`);
              await scriptTagService.delete({ id: nebulaScriptTag.id });
              // Re-create after delete
              const newScriptTag = new admin.rest.resources.ScriptTag({ session });
              newScriptTag.event = "onload";
              newScriptTag.src = expectedScriptUrl;
              await newScriptTag.save({ update: false }); // save as new, not update
              console.log("🎯 Corrected script tag re-injected:", newScriptTag.id);
            }
          } else {
            console.log("Script tag not found. Injecting new script tag.");
            const newScriptTag = new admin.rest.resources.ScriptTag({ session });
            newScriptTag.event = "onload";
            newScriptTag.src = expectedScriptUrl; // Use the defined expected URL
            await newScriptTag.save({ update: false }); // Create new tag
            console.log("🎯 New script tag injected:", newScriptTag.id);
          }
        }
      } catch (error: any) {
        console.error("❌ Failed to inject or manage script tag:", error?.response?.errors || error.message, error.stack);
      }
      // ----- END SCRIPT TAG INJECTION LOGIC -----


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

          console.log(`📞 Calling NestJS init endpoint: ${initEndpoint}`);
          const response = await fetch(initEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              shop: session.shop,
              accessToken: session.accessToken, // This should be the offline token
              scopes: session.scope,           // <<< 2. SENDING THE SCOPES
            }),
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