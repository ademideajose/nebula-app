import { type ActionFunctionArgs, json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  console.log("🔧 Manual setup called for:", shop);


    // Use the REST resources approach (like your afterAuth)
    const scriptTagsResponse = await (admin as any).rest.resources.ScriptTag.all({ session });
    console.log("📋 Script tags response:", scriptTagsResponse?.data?.length || 0, "tags found");
    
    const scriptTagsData = scriptTagsResponse.body as any;
    const scriptTags = scriptTagsData?.script_tags || [];
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

    // Create new script tag using direct REST API
    const result = await admin.rest.post({
      path: "script_tags",
      data: {
        script_tag: {
          event: "onload",
          src: `${new URL(request.url).origin}/inject-agent-link`,
        },
      },
    });

    console.log("📦 Script tag creation response status:", result.status);
    
    const resultData = result.body as any;
    const scriptTag = resultData?.script_tag;

    if (!scriptTag?.id) {
      console.error("❌ No script tag ID in response:", scriptTag);
      throw new Error("Script tag creation failed - no ID returned");
    }

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