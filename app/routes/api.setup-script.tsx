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
    
    const scriptTags = scriptTagsResponse.data || [];

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

    // Create new script tag using your local route
    const scriptTag = await (admin as any).rest.resources.ScriptTag.create({
      session,
      body: {
        event: "onload",
        src: `${new URL(request.url).origin}/inject-agent-link`,
      },
    });

    console.log("📦 Script tag creation response:", scriptTag?.body?.script_tag?.id);
    
    const createdTag = scriptTag?.body?.script_tag;
    
    if (!createdTag?.id) {
      console.error("❌ No script tag ID in response:", createdTag);
      throw new Error("Script tag creation failed - no ID returned");
    }

    console.log("🎯 Script tag created successfully:", createdTag.id);
    
    return json({ 
      success: true, 
      message: "✅ Agent API link installed!",
      scriptTagId: createdTag.id 
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