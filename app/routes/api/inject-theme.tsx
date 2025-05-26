import { type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  const themes = await (admin as any).rest.resources.Theme.all({ session });
  const mainTheme = themes.data.find((t: any) => t.role === "main");

  if (mainTheme) {
    const asset = await (admin as any).rest.resources.Asset.find({
      session,
      theme_id: mainTheme.id,
      asset: { key: "layout/theme.liquid" },
    });

    const currentValue = asset.body.asset.value;
    const discoveryTag = `
<link rel="agent-api" type="application/json" href="https://nebula-app-snhd.onrender.com/agent-api/suggest?shop=${shop}"/>`;

    if (!currentValue.includes('rel="agent-api"')) {
      const updatedValue = currentValue.replace("</head>", `${discoveryTag}\n</head>`);
      await (admin as any).rest.resources.Asset.update({
        session,
        theme_id: mainTheme.id,
        asset: {
          key: "layout/theme.liquid",
          value: updatedValue,
        },
      });

      return new Response("✅ Injected");
    } else {
      return new Response("ℹ️ Already present");
    }
  }

  return new Response("⚠️ No theme found", { status: 404 });
};
