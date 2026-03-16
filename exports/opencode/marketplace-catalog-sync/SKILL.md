---
name: marketplace-catalog-sync
description: Apply when building catalog or SKU synchronization logic for VTEX marketplace seller connectors. Covers the changenotification endpoint, SKU suggestion lifecycle, product data mapping, price and inventory sync, and fulfillment simulation. Use for implementing seller-side catalog integration that pushes SKUs to VTEX marketplaces with proper notification handling and rate-limited batch synchronization.
---

# Catalog & SKU Integration

## Overview

**What this skill covers**: The complete SKU integration flow between an external seller and a VTEX marketplace, including catalog notifications, SKU suggestions, approval lifecycle, and price/inventory synchronization.

**When to use it**: When building a seller connector that needs to push product catalog data into a VTEX marketplace, handle SKU approval workflows, or keep prices and inventory synchronized.

**What you'll learn**:
- How to use the Change Notification endpoint to register and update SKUs
- The SKU suggestion lifecycle (send → pending → approved/denied)
- How to map product data to the VTEX catalog schema
- How to synchronize prices and inventory via notification endpoints

## Key Concepts

**Essential knowledge before implementation**:

### Concept 1: Change Notification Flow

The `POST /api/catalog_system/pvt/skuseller/changenotification/{skuId}` endpoint is the entry point for all catalog integration. When called:
- **200 OK** → The SKU already exists in the marketplace. The seller should update the SKU information.
- **404 Not Found** → The SKU does not exist in the marketplace. The seller must send an SKU suggestion.

This two-response pattern drives the entire integration: notify first, then either update or register based on the response.

### Concept 2: SKU Suggestion Lifecycle

The catalog is owned by the marketplace — the seller has no direct access. Every new SKU is sent as a **suggestion** via the `PUT Send SKU Suggestion` API. The lifecycle is:
1. **Seller sends suggestion** with product name, SKU name, images, EAN, specifications
2. **Suggestion enters "pending" state** in the marketplace's Received SKUs panel
3. **Marketplace approves or denies** — approval creates an actual SKU in the catalog
4. **Once approved**, the suggestion ceases to exist; the SKU can only be edited by the marketplace

Suggestions can be updated by the seller only while still in pending state. Once approved or denied, updates require a new suggestion or direct marketplace action.

### Concept 3: Price & Inventory Notifications

Price and inventory changes use separate notification endpoints (not the catalog changenotification):
- `POST /notificator/{sellerId}/changenotification/{skuId}/price` — notify price change
- `POST /notificator/{sellerId}/changenotification/{skuId}/inventory` — notify inventory change

After these notifications, the marketplace calls the seller's **Fulfillment Simulation** endpoint (`POST /pvt/orderForms/simulation`) to retrieve current data. This endpoint must respond within **2.5 seconds** or the product is considered unavailable.

**Architecture/Data Flow**:

```text
Seller                          VTEX Marketplace
  │                                    │
  │─── POST changenotification ──────▶│
  │◀── 200 (exists) or 404 (new) ────│
  │                                    │
  │─── PUT Send SKU Suggestion ──────▶│  (if 404)
  │                                    │── Pending in Received SKUs
  │                                    │── Marketplace approves/denies
  │                                    │
  │─── POST price notification ──────▶│
  │◀── POST fulfillment simulation ───│  (marketplace fetches data)
  │─── Response with price/stock ────▶│
```

## Constraints

**Rules that MUST be followed to avoid failures, security issues, or platform incompatibilities.**

### Constraint: Use SKU Integration API, Not Direct Catalog API

**Rule**: External sellers MUST use the Change Notification + SKU Suggestion flow to integrate SKUs. Direct Catalog API writes (`POST /api/catalog/pvt/product` or `POST /api/catalog/pvt/stockkeepingunit`) are for marketplace-side operations only.

**Why**: The seller does not own the catalog. Direct catalog writes will fail with 403 Forbidden or create orphaned entries that bypass the approval workflow. The suggestion mechanism ensures marketplace quality control.

**Detection**: If you see direct Catalog API calls for product/SKU creation (e.g., `POST /api/catalog/pvt/product`, `POST /api/catalog/pvt/stockkeepingunit`) from a seller integration → warn that the SKU Integration API should be used instead.

✅ **CORRECT**:
```typescript
import axios, { AxiosInstance } from "axios";

interface SkuSuggestion {
  ProductName: string;
  SkuName: string;
  ImageUrl: string;
  ProductDescription: string;
  BrandName: string;
  CategoryFullPath: string;
  EAN: string;
  Height: number;
  Width: number;
  Length: number;
  WeightKg: number;
  SkuSpecifications: Array<{
    FieldName: string;
    FieldValues: string[];
  }>;
}

async function integrateSellerSku(
  client: AxiosInstance,
  marketplaceAccount: string,
  sellerId: string,
  sellerSkuId: string,
  skuData: SkuSuggestion
): Promise<void> {
  const baseUrl = `https://${marketplaceAccount}.vtexcommercestable.com.br`;

  // Step 1: Send change notification to check if SKU exists
  try {
    await client.post(
      `${baseUrl}/api/catalog_system/pvt/skuseller/changenotification/${sellerSkuId}`
    );
    // 200 OK — SKU exists, marketplace will fetch updates via fulfillment simulation
    console.log(`SKU ${sellerSkuId} exists in marketplace, update triggered`);
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      // 404 — SKU not found, send suggestion
      console.log(`SKU ${sellerSkuId} not found, sending suggestion`);
      await client.put(
        `${baseUrl}/api/catalog_system/pvt/sku/seller/${sellerId}/suggestion/${sellerSkuId}`,
        skuData
      );
      console.log(`SKU suggestion sent for ${sellerSkuId}`);
    } else {
      throw error;
    }
  }
}
```

❌ **WRONG**:
```typescript
// WRONG: Seller trying to write directly to marketplace catalog
// This bypasses the suggestion/approval flow and will fail with 403
async function createSkuDirectly(
  client: AxiosInstance,
  marketplaceAccount: string,
  productData: Record<string, unknown>
): Promise<void> {
  // Direct catalog write — sellers don't have permission for this
  await client.post(
    `https://${marketplaceAccount}.vtexcommercestable.com.br/api/catalog/pvt/product`,
    productData
  );
  // Will fail: 403 Forbidden — seller lacks catalog write permissions
}
```

---

### Constraint: Handle Rate Limiting on Catalog Notifications

**Rule**: All catalog notification calls MUST implement 429 handling with exponential backoff. Batch notifications MUST be throttled to respect VTEX API rate limits.

**Why**: The Change Notification endpoint is rate-limited. Sending bulk notifications without throttling will trigger 429 responses and temporarily block the seller's API access, stalling the entire integration.

**Detection**: If you see catalog notification calls without 429 handling or retry logic → STOP and add rate limiting. If you see a tight loop sending notifications without delays → warn about rate limiting.

✅ **CORRECT**:
```typescript
async function batchNotifySkus(
  client: AxiosInstance,
  baseUrl: string,
  sellerId: string,
  skuIds: string[],
  concurrency: number = 5,
  delayMs: number = 200
): Promise<void> {
  const results: Array<{ skuId: string; status: "exists" | "new" | "error" }> = [];

  for (let i = 0; i < skuIds.length; i += concurrency) {
    const batch = skuIds.slice(i, i + concurrency);

    const batchResults = await Promise.allSettled(
      batch.map(async (skuId) => {
        try {
          await client.post(
            `${baseUrl}/api/catalog_system/pvt/skuseller/changenotification/${sellerId}/${skuId}`
          );
          return { skuId, status: "exists" as const };
        } catch (error: unknown) {
          if (
            error instanceof Error &&
            "response" in error &&
            (error as { response?: { status?: number } }).response?.status === 404
          ) {
            return { skuId, status: "new" as const };
          }
          if (
            error instanceof Error &&
            "response" in error &&
            (error as { response?: { status?: number; headers?: Record<string, string> } })
              .response?.status === 429
          ) {
            const retryAfter = parseInt(
              (error as { response: { headers: Record<string, string> } }).response.headers[
                "retry-after"
              ] || "60",
              10
            );
            console.warn(`Rate limited. Waiting ${retryAfter}s before retry.`);
            await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
            return { skuId, status: "error" as const };
          }
          throw error;
        }
      })
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      }
    }

    // Throttle between batches
    if (i + concurrency < skuIds.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
```

❌ **WRONG**:
```typescript
// WRONG: No rate limiting, no error handling, tight loop
async function notifyAllSkus(
  client: AxiosInstance,
  baseUrl: string,
  sellerId: string,
  skuIds: string[]
): Promise<void> {
  // Fires all requests simultaneously — will trigger 429 rate limits
  await Promise.all(
    skuIds.map((skuId) =>
      client.post(
        `${baseUrl}/api/catalog_system/pvt/skuseller/changenotification/${sellerId}/${skuId}`
      )
    )
  );
}
```

---

### Constraint: Handle Suggestion Lifecycle States

**Rule**: Sellers MUST check the suggestion state before attempting updates. Suggestions can only be updated while in pending state.

**Why**: Attempting to update an already-approved or denied suggestion will fail silently or create duplicate entries. An approved suggestion becomes an SKU owned by the marketplace.

**Detection**: If you see SKU suggestion updates without checking current suggestion status → warn about suggestion lifecycle handling.

✅ **CORRECT**:
```typescript
async function updateSkuSuggestion(
  client: AxiosInstance,
  baseUrl: string,
  sellerId: string,
  sellerSkuId: string,
  updatedData: Record<string, unknown>
): Promise<boolean> {
  // Check current suggestion status before updating
  try {
    const response = await client.get(
      `${baseUrl}/api/catalog_system/pvt/sku/seller/${sellerId}/suggestion/${sellerSkuId}`
    );

    const suggestion = response.data;
    if (suggestion.Status === "Pending") {
      // Safe to update — suggestion hasn't been processed yet
      await client.put(
        `${baseUrl}/api/catalog_system/pvt/sku/seller/${sellerId}/suggestion/${sellerSkuId}`,
        updatedData
      );
      return true;
    }

    // Already approved or denied — cannot update
    console.warn(
      `SKU ${sellerSkuId} suggestion is ${suggestion.Status}, cannot update. ` +
        `Use changenotification to update existing SKUs.`
    );
    return false;
  } catch {
    // Suggestion may not exist — send as new
    await client.put(
      `${baseUrl}/api/catalog_system/pvt/sku/seller/${sellerId}/suggestion/${sellerSkuId}`,
      updatedData
    );
    return true;
  }
}
```

❌ **WRONG**:
```typescript
// WRONG: Blindly sending suggestion update without checking state
async function blindUpdateSuggestion(
  client: AxiosInstance,
  baseUrl: string,
  sellerId: string,
  sellerSkuId: string,
  data: Record<string, unknown>
): Promise<void> {
  // If the suggestion was already approved, this fails silently
  // or creates a duplicate that confuses the marketplace operator
  await client.put(
    `${baseUrl}/api/catalog_system/pvt/sku/seller/${sellerId}/suggestion/${sellerSkuId}`,
    data
  );
}
```

## Implementation Pattern

**The canonical, recommended way to implement SKU catalog integration.**

### Step 1: Set Up the Seller Connector Client

Create an authenticated HTTP client for communicating with the VTEX marketplace.

```typescript
import axios, { AxiosInstance } from "axios";

interface SellerConnectorConfig {
  marketplaceAccount: string;
  sellerId: string;
  appKey: string;
  appToken: string;
}

function createMarketplaceClient(config: SellerConnectorConfig): AxiosInstance {
  return axios.create({
    baseURL: `https://${config.marketplaceAccount}.vtexcommercestable.com.br`,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-VTEX-API-AppKey": config.appKey,
      "X-VTEX-API-AppToken": config.appToken,
    },
    timeout: 10000,
  });
}
```

### Step 2: Implement the Change Notification Flow

Handle both the "exists" (200) and "new" (404) scenarios from the changenotification endpoint.

```typescript
interface CatalogNotificationResult {
  skuId: string;
  action: "updated" | "suggestion_sent" | "error";
  error?: string;
}

async function notifyAndSync(
  client: AxiosInstance,
  sellerId: string,
  sellerSkuId: string,
  skuData: SkuSuggestion
): Promise<CatalogNotificationResult> {
  try {
    await client.post(
      `/api/catalog_system/pvt/skuseller/changenotification/${sellerSkuId}`
    );
    // SKU exists — marketplace will call fulfillment simulation to get updates
    return { skuId: sellerSkuId, action: "updated" };
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      try {
        await client.put(
          `/api/catalog_system/pvt/sku/seller/${sellerId}/suggestion/${sellerSkuId}`,
          skuData
        );
        return { skuId: sellerSkuId, action: "suggestion_sent" };
      } catch (suggestionError: unknown) {
        const message = suggestionError instanceof Error ? suggestionError.message : "Unknown error";
        return { skuId: sellerSkuId, action: "error", error: message };
      }
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return { skuId: sellerSkuId, action: "error", error: message };
  }
}
```

### Step 3: Implement the Fulfillment Simulation Endpoint

The marketplace calls this endpoint on the seller's side to retrieve current price and inventory data after a notification.

```typescript
import { RequestHandler } from "express";

interface SimulationItem {
  id: string;
  quantity: number;
  seller: string;
}

interface SimulationRequest {
  items: SimulationItem[];
  postalCode?: string;
  country?: string;
}

interface SimulationResponseItem {
  id: string;
  requestIndex: number;
  quantity: number;
  seller: string;
  price: number;
  listPrice: number;
  sellingPrice: number;
  priceValidUntil: string;
  availability: string;
  merchantName: string;
}

const fulfillmentSimulationHandler: RequestHandler = async (req, res) => {
  const { items, postalCode, country }: SimulationRequest = req.body;

  const responseItems: SimulationResponseItem[] = await Promise.all(
    items.map(async (item, index) => {
      // Fetch current price and inventory from your system
      const skuInfo = await getSkuFromLocalCatalog(item.id);

      return {
        id: item.id,
        requestIndex: index,
        quantity: Math.min(item.quantity, skuInfo.availableQuantity),
        seller: item.seller,
        price: skuInfo.price,
        listPrice: skuInfo.listPrice,
        sellingPrice: skuInfo.sellingPrice,
        priceValidUntil: new Date(Date.now() + 3600000).toISOString(),
        availability: skuInfo.availableQuantity > 0 ? "available" : "unavailable",
        merchantName: "sellerAccountName",
      };
    })
  );

  // CRITICAL: Must respond within 2.5 seconds or products show as unavailable
  res.json({
    items: responseItems,
    postalCode: postalCode ?? "",
    country: country ?? "",
  });
};

async function getSkuFromLocalCatalog(skuId: string): Promise<{
  price: number;
  listPrice: number;
  sellingPrice: number;
  availableQuantity: number;
}> {
  // Replace with your actual catalog/inventory lookup
  return {
    price: 9990,
    listPrice: 12990,
    sellingPrice: 9990,
    availableQuantity: 15,
  };
}
```

### Step 4: Notify Price and Inventory Changes

Send separate notifications for price and inventory updates.

```typescript
async function notifyPriceChange(
  client: AxiosInstance,
  sellerId: string,
  skuId: string
): Promise<void> {
  await client.post(
    `/notificator/${sellerId}/changenotification/${skuId}/price`
  );
}

async function notifyInventoryChange(
  client: AxiosInstance,
  sellerId: string,
  skuId: string
): Promise<void> {
  await client.post(
    `/notificator/${sellerId}/changenotification/${skuId}/inventory`
  );
}

async function syncPriceAndInventory(
  client: AxiosInstance,
  sellerId: string,
  skuIds: string[]
): Promise<void> {
  for (const skuId of skuIds) {
    await notifyPriceChange(client, sellerId, skuId);
    await notifyInventoryChange(client, sellerId, skuId);

    // Throttle to avoid rate limits
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}
```

### Complete Example

```typescript
import axios from "axios";

async function runCatalogSync(): Promise<void> {
  const config: SellerConnectorConfig = {
    marketplaceAccount: "mymarketplace",
    sellerId: "externalseller01",
    appKey: process.env.VTEX_APP_KEY!,
    appToken: process.env.VTEX_APP_TOKEN!,
  };

  const client = createMarketplaceClient(config);

  // Fetch SKUs that need syncing from your system
  const skusToSync = await getLocalSkusNeedingSync();

  for (const sku of skusToSync) {
    const skuSuggestion: SkuSuggestion = {
      ProductName: sku.productName,
      SkuName: sku.skuName,
      ImageUrl: sku.imageUrl,
      ProductDescription: sku.description,
      BrandName: sku.brand,
      CategoryFullPath: sku.categoryPath,
      EAN: sku.ean,
      Height: sku.height,
      Width: sku.width,
      Length: sku.length,
      WeightKg: sku.weight,
      SkuSpecifications: sku.specifications,
    };

    const result = await notifyAndSync(
      client,
      config.sellerId,
      sku.sellerSkuId,
      skuSuggestion
    );

    console.log(`SKU ${sku.sellerSkuId}: ${result.action}`);

    // Throttle between SKU operations
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  // Sync prices and inventory for all active SKUs
  const activeSkuIds = skusToSync.map((s) => s.sellerSkuId);
  await syncPriceAndInventory(client, config.sellerId, activeSkuIds);
}

async function getLocalSkusNeedingSync(): Promise<
  Array<{
    sellerSkuId: string;
    productName: string;
    skuName: string;
    imageUrl: string;
    description: string;
    brand: string;
    categoryPath: string;
    ean: string;
    height: number;
    width: number;
    length: number;
    weight: number;
    specifications: Array<{ FieldName: string; FieldValues: string[] }>;
  }>
> {
  // Replace with your actual data source
  return [];
}
```

## Anti-Patterns

**Common mistakes developers make and how to fix them.**

### Anti-Pattern: Polling for Suggestion Status in Tight Loops

**What happens**: Developers send a suggestion then immediately poll for approval status in a tight loop, waiting for the marketplace to approve.

**Why it fails**: Suggestion approval is a manual or semi-automatic marketplace process that can take minutes to days. Tight polling wastes API quota and may trigger rate limits that block the entire integration.

**Fix**: Use a scheduled job (cron) to check suggestion statuses periodically (e.g., every 15-30 minutes), or implement a webhook-based notification system.

```typescript
// Correct: Scheduled periodic check, not a tight poll
async function checkPendingSuggestions(
  client: AxiosInstance,
  sellerId: string,
  pendingSkuIds: string[]
): Promise<Array<{ skuId: string; status: string }>> {
  const results: Array<{ skuId: string; status: string }> = [];

  for (const skuId of pendingSkuIds) {
    try {
      const response = await client.get(
        `/api/catalog_system/pvt/sku/seller/${sellerId}/suggestion/${skuId}`
      );
      results.push({ skuId, status: response.data.Status });
    } catch {
      results.push({ skuId, status: "not_found" });
    }

    // Respect rate limits between checks
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  return results;
}
```

---

### Anti-Pattern: Ignoring Fulfillment Simulation Timeout

**What happens**: The seller's fulfillment simulation endpoint performs complex database queries or external API calls that exceed the response time limit.

**Why it fails**: VTEX marketplaces wait a maximum of **2.5 seconds** for a fulfillment simulation response. After that, the product is considered unavailable/inactive and won't appear in the storefront or checkout.

**Fix**: Pre-cache price and inventory data. Use in-memory or Redis cache with event-driven updates so the simulation endpoint responds instantly.

```typescript
import { RequestHandler } from "express";

// Correct: Cache-first approach for fast fulfillment simulation
const cachedPriceInventory = new Map<string, {
  price: number;
  listPrice: number;
  sellingPrice: number;
  availableQuantity: number;
  updatedAt: number;
}>();

const fastFulfillmentSimulation: RequestHandler = async (req, res) => {
  const { items } = req.body;

  const responseItems = items.map((item: SimulationItem, index: number) => {
    const cached = cachedPriceInventory.get(item.id);

    if (!cached) {
      return {
        id: item.id,
        requestIndex: index,
        quantity: 0,
        availability: "unavailable",
      };
    }

    return {
      id: item.id,
      requestIndex: index,
      quantity: Math.min(item.quantity, cached.availableQuantity),
      price: cached.price,
      listPrice: cached.listPrice,
      sellingPrice: cached.sellingPrice,
      availability: cached.availableQuantity > 0 ? "available" : "unavailable",
    };
  });

  // Responds in < 50ms from cache
  res.json({ items: responseItems });
};
```

## Reference

**Links to VTEX documentation and related resources.**

- [External Seller Connector Guide](https://developers.vtex.com/docs/guides/external-seller-integration-connector) — Complete integration flow for external sellers connecting to VTEX marketplaces
- [Change Notification API](https://developers.vtex.com/docs/api-reference/catalog-api#post-/api/catalog_system/pvt/skuseller/changenotification/-skuId-) — API reference for the changenotification endpoint
- [Marketplace API - Manage Suggestions](https://developers.vtex.com/docs/guides/marketplace-api#manage-suggestions) — API reference for sending and managing SKU suggestions
- [External Marketplace Integration - Stock Update](https://developers.vtex.com/docs/guides/external-marketplace-integration-stock-update) — Guide for keeping inventory synchronized
- [External Marketplace Integration - Price Update](https://developers.vtex.com/docs/guides/external-marketplace-integration-price-update) — Guide for keeping prices synchronized
- [Catalog Management for VTEX Marketplace](https://developers.vtex.com/docs/guides/external-seller-integration-vtex-marketplace-operation) — Marketplace-side catalog operations and SKU approval workflows
