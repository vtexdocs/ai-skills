# Headless Front-End Development

Best practices for headless commerce development with VTEX, covering BFF layer, auth proxy, caching, Intelligent Search, and headless patterns. This track covers everything needed to build production-ready headless storefronts that communicate securely with VTEX APIs.

## Overview

Headless commerce decouples the frontend from the backend, allowing developers to build custom storefronts using any framework (React, Vue, Next.js, Nuxt, etc.) while leveraging VTEX Commerce as the backend. This track teaches developers how to build a Backend-for-Frontend (BFF) layer that securely proxies VTEX APIs, manage authentication tokens server-side, implement shopping cart and checkout flows, integrate Intelligent Search for product discovery, and optimize performance through strategic caching. Whether you're building a custom storefront, mobile app, or kiosk, this track provides the patterns and constraints needed for secure, performant headless implementations.

## Skills

| Skill | Description | Link |
|-------|-------------|------|
| **BFF Layer Design & Security** | Build a Backend-for-Frontend layer that proxies VTEX APIs, classify APIs as public vs private, manage `VtexIdclientAutCookie` server-side, and protect API credentials from client-side exposure. | [skills/headless-bff-architecture/skill.md](skills/headless-bff-architecture/skill.md) |
| **Intelligent Search API Integration** | Integrate the only fully public VTEX API designed for frontend consumption. Implement product search, autocomplete, faceted navigation, and send analytics events. | [skills/headless-intelligent-search/skill.md](skills/headless-intelligent-search/skill.md) |
| **Checkout API Proxy & OrderForm Management** | Securely proxy Checkout API operations through the BFF, manage OrderForm lifecycle, handle cart operations, and validate inputs before forwarding to VTEX. | [skills/headless-checkout-proxy/skill.md](skills/headless-checkout-proxy/skill.md) |
| **Caching & Performance for Headless VTEX** | Classify VTEX APIs into cacheable vs non-cacheable, implement CDN caching for Intelligent Search and Catalog, use `stale-while-revalidate` patterns, and manage cache invalidation. | [skills/headless-caching-strategy/skill.md](skills/headless-caching-strategy/skill.md) |

## Recommended Learning Order

1. **Start with BFF Layer Design** — Understand the security architecture and API classification first. This is the foundation for all headless implementations.
2. **Learn Intelligent Search** — Implement product search and discovery. This is the only API safe to call directly from the frontend.
3. **Add Checkout** — Learn how to proxy Checkout API operations securely through the BFF.
4. **Optimize with Caching** — Finally, implement caching strategies to optimize performance and reduce API rate limit consumption.

## Key Constraints Summary

- **A BFF layer is mandatory for headless VTEX** — Never call private VTEX APIs directly from the frontend. All private APIs require API keys that must be protected server-side.
- **Intelligent Search is the ONLY public API safe for frontend calls** — All other VTEX APIs require authentication and must be proxied through the BFF.
- **`VtexIdclientAutCookie` must be managed server-side** — This JWT token is a 24-hour session token. Never expose it to the client. Always validate it server-side before using it.
- **Never expose `VTEX_APP_KEY` and `VTEX_APP_TOKEN` to the client** — These are permanent credentials. Protect them in environment variables on the server only.
- **Checkout API handles sensitive data** — Profile, address, and payment information must never be sent directly from the client. Always proxy through the BFF.
- **Cache only read-only, non-personalized data** — Never cache Checkout, Profile, OMS, or Payments APIs. Caching personal data causes stale information and security issues.
- **Implement `stale-while-revalidate` for optimal performance** — Serve cached data while revalidating in the background. This balances freshness and performance.

## Related Tracks

- **For FastStore-based storefronts**, see [Track 1: FastStore Implementation & Customization](../faststore/index.md) — Use FastStore for pre-built headless components.
- **For VTEX IO backend services**, see [Track 3: Custom VTEX IO Apps](../vtex-io/index.md) — Build custom backend services to extend headless storefronts.
- **For marketplace integrations**, see [Track 4: Marketplace Integration](../marketplace/index.md) — Build marketplace storefronts with headless architecture.
