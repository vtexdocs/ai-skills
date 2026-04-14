---
name: sales-app-discovery-and-use-cases
description: Discovery flow for identifying what Sales App extension to build, including use case detection keywords, targeted follow-up questions per use case, and API authentication strategy decision tree. Use during Step 1 (Discovery) of the workflow.
metadata:
  version: "1.0"
---

# Discovery Flow and Use Cases

## Use Case Detection

Detect the use case from keywords in the user's description:

| Use Case | Keywords | Complexity | Requires API | Requires Hooks |
|----------|----------|------------|-------------|----------------|
| Static Information | message, warning, banner, badge, text, static, fixed | Simple | No | No |
| Loyalty Program | loyalty, points, benefit, redeem, cashback, program | Medium | Yes | Yes |
| Additional Services | warranty, insurance, installation, assembly, service, extra | Medium | Yes | Yes |
| Product Recommendations | recommendation, suggestion, related, complementary, cross-sell, upsell | High | Yes | Yes |
| Custom Discounts | discount, coupon, promotion, price, voucher | High | Yes | Yes |
| User Profile Display | profile, user, seller, menu, drawer | Simple | No | Yes |

## Discovery Questions by Use Case

### Static Information

1. **Content type**: Text message, Banner/Card, Badge/Tag, List of information, or Alert/Warning?
2. **Location**: Which extension point?
   - `cart.cart-list.after` — After the cart items list
   - `cart.order-summary.after` — After the order summary
   - `pdp.sidebar.before` — Before the PDP sidebar
   - `pdp.sidebar.after` — After the PDP sidebar
   - `pdp.content.after` — After the PDP content
3. **Content**: What text/information to display?

**Recommended extension points**: `cart.cart-list.after`, `cart.order-summary.after`, `pdp.sidebar.before`
**Required hooks**: none
**Template**: Simple

### Loyalty Program

1. **Data source**: Own external API, VTEX IO app, VTEX Master Data, Third-party API, or Not sure yet?
2. **API endpoint**: Path (e.g., `/_v/my-loyalty/points`) — only if external data source
3. **HTTP method**: GET, POST, PUT, or DELETE?
4. **Request params**: Parameters, query strings, or request body to send
5. **Response format**: JSON structure of the API response (required for component data mapping)
6. **Features**: Display points balance, Show earnings with purchase, Allow points redemption, Display customer level
7. **Location**: `cart.order-summary.after` or `menu.drawer-content`
8. **Interaction**: View only or Interactive (redeem points, apply discounts)?

**Recommended extension points**: `cart.order-summary.after`, `menu.drawer-content`
**Required hooks**: useCart, useExtension, useCurrentUser
**Template**: API (IO Proxy or Direct Auth)

### Additional Services

1. **Service types**: Extended warranty, Insurance, Installation, Assembly, Customization, Other
2. **Data source**: External API, VTEX IO app, Fixed list in code, or VTEX Catalog?
3. **API endpoint**: Path — only if external data source
4. **HTTP method**: GET, POST, PUT, or DELETE?
5. **Request params**: Parameters or request body
6. **Response format**: JSON structure of the API response
7. **Location**: `cart.cart-item.after` (per item) or `pdp.sidebar.after` (product page)
8. **Pricing model**: Fixed price, Percentage of product, or Calculated by API?

**Recommended extension points**: `cart.cart-item.after`, `pdp.sidebar.after`
**Required hooks**: useCart, useCartItem, usePDP
**Template**: Hook or API (depending on data source)

### Product Recommendations

1. **Recommendation type**: Frequently bought together, Accessories, Similar products, Upgrades
2. **Data source**: Own API, VTEX Intelligent Search, Fixed rules, or Third-party API?
3. **API endpoint**: Path — only if external data source
4. **HTTP method**: GET, POST, PUT, or DELETE?
5. **Request params**: Parameters or request body
6. **Response format**: JSON structure of the API response
7. **Location**: `cart.cart-list.after` or `pdp.content.after`
8. **Quick add**: Can the seller quickly add recommended products to the cart?
9. **Display count**: 3, 4, 6 products, or customizable?

**Recommended extension points**: `cart.cart-list.after`, `pdp.content.after`
**Required hooks**: useCart, usePDP, useExtension
**Template**: API (IO Proxy or Direct Auth)

### Custom Discounts

1. **Discount types**: Discount coupon, Manual seller discount, Volume discount, Special promotion
2. **Validation source**: Own promotions API, VTEX Promotions, or Fixed coupon list?
3. **API endpoint**: Path for validation — only if external API
4. **HTTP method**: GET, POST, PUT, or DELETE?
5. **Request params**: Parameters or request body
6. **Response format**: JSON structure of the API response
7. **Discount limits**: No limit, Maximum percentage, Maximum value, or Depends on seller level?
8. **Approval needed**: No, Yes above a certain value, or Always?

**Recommended extension points**: `cart.order-summary.after`
**Required hooks**: useCart, useCurrentUser, useExtension
**Template**: API (IO Proxy or Direct Auth)

### User Profile Display

1. **Information to display**: Name, Email, Sales metrics, Goals, Quick settings
2. **Metrics source** (if metrics selected): No metrics, Internal API, VTEX OMS, or Static data?

**Recommended extension points**: `menu.drawer-content`
**Required hooks**: useCurrentUser, useExtension
**Template**: Hook (no API if only using useCurrentUser data)

## API Authentication Decision Tree

When the use case requires an external API:

### Step 1: Confirm API details

Collect: HTTP method, request parameters/body, and API response JSON structure.

### Step 2: Does the API need authentication?

- **No** → Use the basic API template. Done.
- **Yes** → Continue to Step 3.

### Step 3: Does the user have a VTEX IO proxy app?

A VTEX IO proxy app acts as a middleware: the Sales App extension calls the IO app using `credentials: 'include'` to forward session cookies, and the IO app calls the external API with the secret keys on the server side. The keys never leave the server.

- **Yes** → Collect the IO app endpoint path (relative, starting with `/`). Use IO Proxy template. Done.
- **No** → Continue to Step 4.

### Step 4: Implement IO proxy first, or continue with insecure direct auth?

- **Implement IO proxy first** → Stop the Sales App extension workflow. The user should build the IO proxy app first and return later.
- **Continue with insecure direct auth** → Continue to Step 5.

### Step 5: Security warning and direct auth details

**⚠️ WARNING**: Passing authentication keys directly in frontend code is **NOT secure**. The keys will be visible to anyone inspecting the browser. Confirm the user understands and accepts the risk.

If confirmed, collect:
- Auth header name (e.g., `x-api-key`, `Authorization`)
- Auth header value (e.g., `Bearer your-token`, `your-api-key`)
- Full API endpoint URL

Use the Direct Auth template.

### IO Proxy Critical Rule

The `fetch` call in the extension must use **ONLY the relative path** (e.g., `/_v/my-api/endpoint`). **NEVER** prefix with `https://` or a domain like `{account}.myvtex.com`. The Sales App has an internal proxy that automatically resolves the domain.
