# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Gupta Enterprises (artifacts/gupta-enterprises)

Flipkart-style stationery e-commerce web app for Ashutosh Gupta in Kohima, Nagaland.
Shop config (address, phone, email, lat/lng, 15km delivery radius) lives in `src/lib/shopConfig.ts`.

Key features in place:
- Firebase auth with role-based access (USER / ADMIN / DELIVERY_AGENT)
- Catalog with categories, products, favorites, reviews, cart, coupons
- Leaflet/OpenStreetMap shop map and delivery-radius checkout
- Order tracking, admin analytics, notifications
- Same-day-delivery promo bar in `Navbar`, mutual contact `Footer`
- `/dashboard` user dashboard, `/refer` referral page
- Buy Now button on product detail (adds to cart then jumps to checkout)
- Real-time cart sync via 5s polling on cart page
- Per-user coupon redemption limit enforced in `cart.ts /apply-coupon`
- Printable invoice on `OrderDetailPage` via `window.print()`

Generated API client URLs already include the `/api` prefix, so `setBaseUrl(null)` is correct in dev — the proxy serves `/api/*` to api-server on port 8080.
