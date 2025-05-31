import type { LoaderFunctionArgs } from "@remix-run/node";
import { readFileSync } from "fs";
import { join } from "path";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // Read the script file from the public directory
    const scriptPath = join(process.cwd(), "public", "inject-agent-link.js");
    const scriptContent = readFileSync(scriptPath, "utf-8");
    
    return new Response(scriptContent, {
      headers: {
        "Content-Type": "application/javascript",
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error("Error serving inject-agent-link.js:", error);
    return new Response("// Script not found", {
      status: 404,
      headers: {
        "Content-Type": "application/javascript",
      },
    });
  }
};