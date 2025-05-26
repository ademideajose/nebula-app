import { type LoaderFunctionArgs, json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  console.log("🔧 Manual setup called for:", shop);

  try {
    // Check if script tag already exists
    const scriptTagsResponse = await admin.rest.get({ path: "script_tags" });
    
    // Parse the response properly
    const scriptTagsData = scriptTagsResponse.body as any;
    const scriptTags = scriptTagsData?.script_tags || [];
    
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

    // Create new script tag pointing to your hosted script
    const result = await admin.rest.post({
      path: "script_tags",
      data: {
        script_tag: {
          event: "onload",
          src: `${new URL(request.url).origin}/inject-agent-link`,
        },
      },
    });

    // Parse the creation response
    const resultData = result.body as any;
    const scriptTag = resultData?.script_tag;

    if (!scriptTag?.id) {
      throw new Error("Script tag creation response malformed");
    }

    console.log("🎯 Script tag created:", scriptTag?.id);
    
    return json({ 
      success: true, 
      message: "✅ Agent API link installed!",
      scriptTagId: scriptTag?.id 
    });
    
  } catch (error: any) {
    const errorMessage = error?.message || JSON.stringify(error);
    console.error("❌ Setup error:", errorMessage);
    return json({ 
      success: false, 
      message: `❌ Failed: ${error.message}`,
    }, { status: 500 });
  }
};