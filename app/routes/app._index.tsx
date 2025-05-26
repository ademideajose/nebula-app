import { useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  Box,
  List,
  Link,
  InlineStack,
  Banner,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

type SetupResponse = {
  type: "setup";
  success: boolean;
  message: string;
  scriptTagId?: string;
};

type ProductResponse = {
  type: "setup";
  product: any;
  variant: any;
};
type ActionResponse = SetupResponse | ProductResponse;

type LoaderData = {
  setupStatus?: SetupResponse;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  
  // Check script tag status on load
  try {
    if (!admin.rest?.resources?.ScriptTag) {
      return json<LoaderData>({ 
        setupStatus: { 
          type: "setup",
          success: false, 
          message: "REST resources not configured" 
        } 
      });
    }

    const scriptTagsResponse = await admin.rest.resources.ScriptTag.all({ 
      session,
    });
    const scriptTags = scriptTagsResponse.data || [];
    
    const existing = scriptTags.find((tag: any) =>
      tag.src && tag.src.includes("inject-agent-link")
    );

    if (existing) {
      return json<LoaderData>({ 
        setupStatus: { 
          type: "setup",
          success: true, 
          message: "✅ Agent API already installed",
          scriptTagId: existing.id ? String(existing.id) : undefined
        } 
      });
    }

    return json<LoaderData>({});
  } catch (error) {
    console.error("Error checking script tags:", error);
    return json<LoaderData>({});
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  
  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "setup-script") {
    try {
      console.log("🔧 Setting up script tag...");

      // Check if REST resources are available
      if (!admin.rest?.resources?.ScriptTag) {
        return json<SetupResponse>({ 
          type: "setup",
          success: false, 
          message: "❌ REST resources not configured. Please add restResources to shopify.server.ts" 
        });
      }

      // Get all script tags
      const scriptTagsResponse = await admin.rest.resources.ScriptTag.all({ 
        session,
      });
      const scriptTags = scriptTagsResponse.data || [];
      
      // Check if our script tag already exists
      const existing = scriptTags.find((tag: any) =>
        tag.src && tag.src.includes("inject-agent-link")
      );

      if (existing) {
        console.log("✅ Script tag already exists:", existing.id);
        return json<SetupResponse>({ 
          type: "setup",
          success: true, 
          message: "✅ Already installed",
          scriptTagId: existing.id ? String(existing.id) : undefined
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
      
      return json<SetupResponse>({ 
        type: "setup",
        success: true, 
        message: "✅ Agent API link installed!",
        scriptTagId: scriptTag.id ? String(scriptTag.id) : undefined
      });
      
    } catch (error: any) {
      console.error("❌ Setup error:", error);
      return json<SetupResponse>({ 
        type: "setup",
        success: false, 
        message: `❌ Failed: ${error?.message || "Unknown error"}`,
      });
    }
  }

  // Handle product generation action
  const color = ["Red", "Orange", "Yellow", "Green"][
    Math.floor(Math.random() * 4)
  ];
  const response = await admin.graphql(
    `#graphql
      mutation populateProduct($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
            handle
            status
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  barcode
                  createdAt
                }
              }
            }
          }
        }
      }`,
    {
      variables: {
        product: {
          title: `${color} Snowboard`,
        },
      },
    },
  );
  const responseJson = await response.json();

  const product = responseJson.data!.productCreate!.product!;
  const variantId = product.variants.edges[0]!.node!.id!;

  const variantResponse = await admin.graphql(
    `#graphql
    mutation shopifyRemixTemplateUpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          price
          barcode
          createdAt
        }
      }
    }`,
    {
      variables: {
        productId: product.id,
        variants: [{ id: variantId, price: "100.00" }],
      },
    },
  );

  const variantResponseJson = await variantResponse.json();

  return json({
    product: responseJson!.data!.productCreate!.product,
    variant:
      variantResponseJson!.data!.productVariantsBulkUpdate!.productVariants,
  });
};

export default function Index() {
  const { setupStatus } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<ActionResponse>();
  const setupFetcher = useFetcher<SetupResponse>();

  // Type guard to check if response has product
  const hasProduct = (
    data: unknown
  ): data is { product: any; variant: any } => {
    return (
      typeof data === "object" &&
      data !== null &&
      "product" in data &&
      "variant" in data
    );
  };
  
  const shopify = useAppBridge();
  const isLoading =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";
    
  const productId = hasProduct(fetcher.data) 
    ? fetcher.data.product?.id.replace("gid://shopify/Product/", "")
    : undefined;

  useEffect(() => {
    // Auto-setup script tag if not already installed
    if (!setupStatus?.success && setupFetcher.state === "idle" && !setupFetcher.data) {
      console.log("🚀 Auto-running agent API setup...");
      const formData = new FormData();
      formData.append("action", "setup-script");
      setupFetcher.submit(formData, { method: "POST" });
    }
  }, [setupFetcher, setupStatus]);


  useEffect(() => {
    if (productId) {
      shopify.toast.show("Product created");
    }
  }, [productId, shopify]);
  
  const generateProduct = () => fetcher.submit({}, { method: "POST" });

  // Use setupFetcher data if available, otherwise use loader data
  const displayStatus = setupFetcher.data || setupStatus;

  return (
    <Page>
      <TitleBar title="Remix app template">
        <button variant="primary" onClick={generateProduct}>
          Generate a product
        </button>
      </TitleBar>
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                {/* Setup Status Banner - Add this */}
              {displayStatus && (
                  <Banner
                    tone={displayStatus.success ? "success" : "critical"}
                    title="Agent API Setup"
                  >
                    {displayStatus.message}
                    {displayStatus.scriptTagId && (
                      <Text as="p" variant="bodyMd">
                        Script Tag ID: {displayStatus.scriptTagId}
                      </Text>
            )}
          </Banner>
        )}
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Congrats on creating a new Shopify app 🎉
                  </Text>
                  <Text variant="bodyMd" as="p">
                    This embedded app template uses{" "}
                    <Link
                      url="https://shopify.dev/docs/apps/tools/app-bridge"
                      target="_blank"
                      removeUnderline
                    >
                      App Bridge
                    </Link>{" "}
                    interface examples like an{" "}
                    <Link url="/app/additional" removeUnderline>
                      additional page in the app nav
                    </Link>
                    , as well as an{" "}
                    <Link
                      url="https://shopify.dev/docs/api/admin-graphql"
                      target="_blank"
                      removeUnderline
                    >
                      Admin GraphQL
                    </Link>{" "}
                    mutation demo, to provide a starting point for app
                    development.
                  </Text>
                </BlockStack>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd">
                    Get started with products
                  </Text>
                  <Text as="p" variant="bodyMd">
                    Generate a product with GraphQL and get the JSON output for
                    that product. Learn more about the{" "}
                    <Link
                      url="https://shopify.dev/docs/api/admin-graphql/latest/mutations/productCreate"
                      target="_blank"
                      removeUnderline
                    >
                      productCreate
                    </Link>{" "}
                    mutation in our API references.
                  </Text>
                </BlockStack>
                <InlineStack gap="300">
                  <Button loading={isLoading} onClick={generateProduct}>
                    Generate a product
                  </Button>
                  {hasProduct(fetcher.data)&& (
                    <Button
                      url={`shopify:admin/products/${productId}`}
                      target="_blank"
                      variant="plain"
                    >
                      View product
                    </Button>
                  )}
                </InlineStack>
                {hasProduct(fetcher.data) && (
                  <>
                    <Text as="h3" variant="headingMd">
                      {" "}
                      productCreate mutation
                    </Text>
                    <Box
                      padding="400"
                      background="bg-surface-active"
                      borderWidth="025"
                      borderRadius="200"
                      borderColor="border"
                      overflowX="scroll"
                    >
                      <pre style={{ margin: 0 }}>
                        <code>
                          {JSON.stringify(fetcher.data.product, null, 2)}
                        </code>
                      </pre>
                    </Box>
                    <Text as="h3" variant="headingMd">
                      {" "}
                      productVariantsBulkUpdate mutation
                    </Text>
                    <Box
                      padding="400"
                      background="bg-surface-active"
                      borderWidth="025"
                      borderRadius="200"
                      borderColor="border"
                      overflowX="scroll"
                    >
                      <pre style={{ margin: 0 }}>
                        <code>
                          {JSON.stringify(fetcher.data.variant, null, 2)}
                        </code>
                      </pre>
                    </Box>
                  </>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <BlockStack gap="500">
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    App template specs
                  </Text>
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">
                        Framework
                      </Text>
                      <Link
                        url="https://remix.run"
                        target="_blank"
                        removeUnderline
                      >
                        Remix
                      </Link>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">
                        Database
                      </Text>
                      <Link
                        url="https://www.prisma.io/"
                        target="_blank"
                        removeUnderline
                      >
                        Prisma
                      </Link>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">
                        Interface
                      </Text>
                      <span>
                        <Link
                          url="https://polaris.shopify.com"
                          target="_blank"
                          removeUnderline
                        >
                          Polaris
                        </Link>
                        {", "}
                        <Link
                          url="https://shopify.dev/docs/apps/tools/app-bridge"
                          target="_blank"
                          removeUnderline
                        >
                          App Bridge
                        </Link>
                      </span>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">
                        API
                      </Text>
                      <Link
                        url="https://shopify.dev/docs/api/admin-graphql"
                        target="_blank"
                        removeUnderline
                      >
                        GraphQL API
                      </Link>
                    </InlineStack>
                  </BlockStack>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Next steps
                  </Text>
                  <List>
                    <List.Item>
                      Build an{" "}
                      <Link
                        url="https://shopify.dev/docs/apps/getting-started/build-app-example"
                        target="_blank"
                        removeUnderline
                      >
                        {" "}
                        example app
                      </Link>{" "}
                      to get started
                    </List.Item>
                    <List.Item>
                      Explore Shopify’s API with{" "}
                      <Link
                        url="https://shopify.dev/docs/apps/tools/graphiql-admin-api"
                        target="_blank"
                        removeUnderline
                      >
                        GraphiQL
                      </Link>
                    </List.Item>
                  </List>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
