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
- Catalog with categories, products (with `tags`, `isFeatured`, `salesCount`, `lowStockThreshold`),
  favorites, reviews, cart, coupons
- Leaflet/OpenStreetMap shop map and delivery-radius checkout
- Order tracking, admin analytics, notifications
- Same-day-delivery promo bar in `Navbar` (Flipkart blue `#2874F0`), mutual contact `Footer`
- `/dashboard` user dashboard, `/refer` referral page
- Buy Now button on product detail (adds to cart then jumps to checkout)
- Real-time cart sync via 5s polling on cart page
- Per-user coupon redemption limit enforced in `cart.ts /apply-coupon`
- Printable invoice on `OrderDetailPage` via `window.print()`

Recent additions:
- Merged Home + Products into a single `HomePage` (no more separate `/products` route — old links
  redirect to `/` with the same query string). Layout: category strip → admin banner carousel →
  Featured/Discount/Top-Selling rails → filter sidebar (incl. tag filtering) + product grid →
  refer-and-earn promo → recently-viewed → bottom banner → about + map.
- Admin-managed banners with optional `productId` link (TOP banners auto-rotate as a carousel).
  Admin UI in `AdminBanners` includes a product picker.
- Refer & Earn + Super Coins wallet: 50 coins for referee, 100 for referrer, 1 coin = ₹1.
  Every order earns 2% back as coins, and customers can redeem up to 50% of any order at checkout.
  Backend tables: `users.superCoins`, `users.referralCode`, `coinTransactions`. UI: `ReferEarnPage`
  shows balance + transaction history; `CheckoutPage` has a coin-redemption slider.
- Advanced Admin Dashboard: total sales, day-wise + custom-range sales chart, low-stock alerts,
  top-selling products with #1/#2/#3 medals, inventory insights (SKUs, stock units, value, low/out),
  and existing revenue + status charts.

Dev workflow: `scripts/dev.sh` builds the api-server then runs it on port 8080, and runs the
gupta-enterprises Vite dev server on port `5000` (Replit webview port). The `Start application`
workflow waits for port 5000 to come up.

Generated API client URLs already include the `/api` prefix, so `setBaseUrl(null)` is correct in dev — the proxy serves `/api/*` to api-server on port 8080.
