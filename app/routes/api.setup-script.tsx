import { type ActionFunctionArgs, json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  console.log("🔧 Manual setup called for:", shop);


    // Check if admin and REST resources are available
    if (!admin || !admin.rest || !admin.rest.resources) {
      throw new Error("REST resources not configured. Please add restResources to shopify.server.ts");
    }

    // Get all script tags
    const scriptTagsResponse  = await admin.rest.resources.ScriptTag.all({ 
      session,
    });
    
    // Extract the data array from the response
    const scriptTags = scriptTagsResponse.data || [];

    console.log("📋 Found script tags:", scriptTags.length);


    const existing = scriptTags.find((tag: any) =>
      tag.src && tag.src.includes("inject-agent-link")
    );

    if (existing) {
      console.log("✅ Script tag already exists:", existing.id);
      return json({ 
        success: true, 
        message: "✅ Already installed",
        scriptTagId: existing.id 
      });
    }

    console.log("➕ Creating new script tag...");

    // Create new script tag
    const scriptTag = new admin.rest.resources.ScriptTag({session});
    scriptTag.event = "onload";
    scriptTag.src = `${new URL(request.url).origin}/inject-agent-link.js`;
    
    await scriptTag.save({
      update: true,
    });

    console.log("🎯 Script tag created successfully:", scriptTag.id);
    
    return json({ 
      success: true, 
      message: "✅ Agent API link installed!",
      scriptTagId: scriptTag.id
    });
    
  } catch (error: any) {
    console.error("❌ Setup error details:", {
      message: error?.message,
      response: error?.response,
      status: error?.status,
      fullError: error
    });
    
    const errorMessage = error?.message || error?.toString() || "Unknown error occurred";
    
    return json({ 
      success: false, 
      message: `❌ Failed: ${errorMessage}`,
    }, { status: 500 });
  }
};