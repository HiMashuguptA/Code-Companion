# Code-Companion Codebase Architecture Summary

## 1. API ENDPOINTS

### Base URL: `/api`

#### **Health**
- `GET /` - Health check endpoint

#### **Authentication** (`/auth`)
- `POST /register` - Register or sync Firebase user
- `GET /profile` - Get current user profile (requires auth)
- `PUT /profile` - Update user profile (requires auth)

#### **Products** (`/products`)
- `GET /` - List products with filters (category, search, minPrice, maxPrice, inStock, pagination)
- `GET /featured` - Get featured products
- `GET /:productId` - Get single product details
- `POST /` - Create product (admin only)
- `PUT /:productId` - Update product (admin only)
- `DELETE /:productId` - Delete product (admin only)

#### **Categories** (`/categories`)
- `GET /` - List all categories with product counts
- `POST /` - Create category (admin only)

#### **Cart** (`/cart`)
- `GET /` - Get user's cart (requires auth)
- `POST /` - Add product to cart (requires auth)
- `PUT /:itemId` - Update cart item quantity (requires auth)
- `DELETE /:itemId` - Remove item from cart (requires auth)
- `DELETE /` - Clear entire cart (requires auth)
- `POST /apply-coupon` - Apply coupon to cart (requires auth)

#### **Orders** (`/orders`)
- `GET /` - List orders (users see own, admins see all with optional status filter)
- `POST /` - Create order from cart (requires auth)
- `GET /delivery-agent` - Get orders assigned to delivery agent (requires auth + delivery agent role)
- `GET /:orderId` - Get single order details (requires auth)
- `PUT /:orderId` - Update order status (admin only)
- `POST /:orderId/assign-delivery-agent` - Assign delivery agent (admin only)

#### **Coupons** (`/coupons`)
- `GET /` - List all coupons (admin only)
- `POST /` - Create coupon (admin only)
- `PUT /:couponId` - Update coupon (admin only)
- `DELETE /:couponId` - Delete coupon (admin only)
- `POST /validate` - Validate coupon code without auth

#### **Reviews** (`/reviews`)
- `GET /product/:productId` - Get reviews for a product
- `POST /product/:productId` - Create review (requires auth + delivered order with product)
- `PUT /:reviewId` - Update review (admin only)
- `DELETE /:reviewId` - Delete review (admin only)

#### **Users** (`/users`)
- `GET /` - List users with optional role filter (admin only)
- `GET /:userId` - Get user details (admin only)
- `PUT /:userId` - Update user role/status (admin only)

#### **Tracking** (`/tracking`)
- `GET /:orderId` - Get order tracking info with agent location and delivery address
- `PUT /:orderId/location` - Update delivery agent's current location (delivery agent only)

#### **Notifications** (`/notifications`)
- `GET /` - Get user's notifications (requires auth, limit 50, sorted by recency)
- `PUT /:notificationId/read` - Mark notification as read (requires auth)
- `PUT /read-all` - Mark all notifications as read (requires auth)

#### **Analytics** (`/analytics`)
- `GET /dashboard` - Get dashboard analytics: revenue, orders, users, products growth metrics (admin only, supports period param)
- `GET /revenue` - Get revenue analytics with date range
- `GET /order-stats` - Get order statistics by status

---

## 2. DATABASE SCHEMA

### **users** Table
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PRIMARY KEY |
| firebaseUid | text | NOT NULL, UNIQUE |
| email | text | NOT NULL, UNIQUE |
| name | text | nullable |
| phone | text | nullable |
| photoUrl | text | nullable |
| role | enum(USER, ADMIN, DELIVERY_AGENT) | DEFAULT 'USER' |
| isActive | boolean | DEFAULT true |
| addresses | jsonb | DEFAULT '[]' (array of address objects with lat/lng) |
| createdAt | timestamp | DEFAULT now() |
| updatedAt | timestamp | AUTO-UPDATE |

### **products** Table
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PRIMARY KEY |
| name | text | NOT NULL |
| description | text | NOT NULL |
| categoryId | integer | FK → categories.id |
| actualPrice | numeric(10,2) | NOT NULL |
| sellingPrice | numeric(10,2) | NOT NULL |
| images | text[] | NOT NULL (array of image URLs) |
| stock | integer | DEFAULT 0 |
| isActive | boolean | DEFAULT true |
| createdAt | timestamp | DEFAULT now() |
| updatedAt | timestamp | AUTO-UPDATE |

### **categories** Table
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PRIMARY KEY |
| name | text | NOT NULL |
| slug | text | NOT NULL, UNIQUE |
| icon | text | nullable |
| createdAt | timestamp | DEFAULT now() |

### **carts** Table
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PRIMARY KEY |
| userId | integer | NOT NULL, UNIQUE |
| items | jsonb | DEFAULT '[]' (array of {id, productId, quantity, price}) |
| couponCode | jsonb | nullable |
| updatedAt | timestamp | AUTO-UPDATE |

### **orders** Table
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PRIMARY KEY |
| userId | integer | NOT NULL |
| items | jsonb | NOT NULL (array with id, productId, quantity, price, total, productName, productImage) |
| status | enum | PENDING, CONFIRMED, PROCESSING, PACKED, OUT_FOR_DELIVERY, DELIVERED, CANCELLED, PICKUP_READY, PICKED_UP |
| deliveryType | enum(DELIVERY, PICKUP) | DEFAULT 'DELIVERY' |
| deliveryAddress | jsonb | nullable (contains lat, lng, street, city, etc.) |
| subtotal | numeric(10,2) | NOT NULL |
| discount | numeric(10,2) | DEFAULT 0 |
| couponDiscount | numeric(10,2) | DEFAULT 0 |
| total | numeric(10,2) | NOT NULL |
| couponCode | text | nullable |
| deliveryAgentId | integer | FK → users.id (nullable) |
| estimatedDelivery | timestamp | nullable |
| paymentStatus | enum(PENDING, PAID, FAILED, REFUNDED) | DEFAULT 'PENDING' |
| paymentMethod | text | nullable |
| notes | text | nullable |
| createdAt | timestamp | DEFAULT now() |
| updatedAt | timestamp | AUTO-UPDATE |

### **tracking** Table
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PRIMARY KEY |
| orderId | integer | NOT NULL, UNIQUE |
| agentId | integer | FK → users.id (nullable) |
| currentLat | numeric(10,7) | nullable |
| currentLng | numeric(10,7) | nullable |
| destinationLat | numeric(10,7) | nullable |
| destinationLng | numeric(10,7) | nullable |
| history | jsonb | DEFAULT '[]' (array of {status, message, timestamp}) |
| updatedAt | timestamp | AUTO-UPDATE |

### **coupons** Table
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PRIMARY KEY |
| code | text | NOT NULL, UNIQUE |
| description | text | nullable |
| discountType | enum(FLAT, PERCENTAGE) | NOT NULL |
| discountValue | numeric(10,2) | NOT NULL |
| minOrderValue | numeric(10,2) | nullable |
| maxDiscount | numeric(10,2) | nullable |
| isFirstOrder | boolean | DEFAULT false |
| isActive | boolean | DEFAULT true |
| usageLimit | integer | nullable |
| usageCount | integer | DEFAULT 0 |
| expiresAt | timestamp | nullable |
| createdAt | timestamp | DEFAULT now() |

### **notifications** Table
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PRIMARY KEY |
| userId | integer | NOT NULL |
| title | text | NOT NULL |
| message | text | NOT NULL |
| type | enum(ORDER_UPDATE, DELIVERY_UPDATE, PROMOTION, SYSTEM) | DEFAULT 'SYSTEM' |
| isRead | boolean | DEFAULT false |
| orderId | integer | FK → orders.id (nullable) |
| createdAt | timestamp | DEFAULT now() |

### **reviews** Table
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PRIMARY KEY |
| productId | integer | NOT NULL |
| userId | integer | NOT NULL |
| orderId | integer | NOT NULL |
| rating | integer | NOT NULL |
| title | text | nullable |
| body | text | nullable |
| createdAt | timestamp | DEFAULT now() |
| updatedAt | timestamp | AUTO-UPDATE |

---

## 3. AUTHENTICATION

### Implementation Strategy
- **Firebase Authentication** for frontend login
- **JWT Token-based** API authentication

### Flow
1. User logs in with Firebase credentials (frontend handles)
2. Firebase provides ID token
3. Frontend sends requests with `Authorization: Bearer <idToken>`
4. Backend middleware (`authenticateUser`) validates token:
   - Extracts Firebase UID from JWT payload (user_id or sub claim)
   - Looks up user in database by firebaseUid
   - Attaches userId and userRole to request object
   - Returns 401 if user not found or token invalid

### User Registration
- `POST /auth/register` endpoint syncs Firebase user with database
- Creates new user record if doesn't exist
- Assigns default role: `USER`

### Authentication Middleware
**Location**: [artifacts/api-server/src/middlewares/auth.ts](artifacts/api-server/src/middlewares/auth.ts)

#### Functions:
- `authenticateUser` - Base authentication (all protected routes)
- `requireAdmin` - Admin-only routes
- `requireDeliveryAgent` - Delivery agent routes (includes admins)

### Roles
1. **USER** - Customer (default)
2. **ADMIN** - Full system access
3. **DELIVERY_AGENT** - Can manage deliveries and view assigned orders

---

## 4. CART IMPLEMENTATION

### Flow
1. **Get/Create Cart**: Triggered when user first adds to cart
   - One cart per user (unique userId constraint)
   - Auto-created if doesn't exist

2. **Add to Cart**: `POST /cart`
   - Validates product exists and has sufficient stock
   - If item exists: increments quantity
   - If new item: creates entry with {id, productId, quantity, price}
   - Price captured at add-time (snapshot)

3. **Update Item**: `PUT /cart/:itemId`
   - Update quantity for specific cart item
   - If quantity ≤ 0: removes item

4. **Remove Item**: `DELETE /cart/:itemId`
   - Delete specific item by ID

5. **Clear Cart**: `DELETE /cart`
   - Empties all items and coupon code

6. **Apply Coupon**: `POST /cart/apply-coupon`
   - Validates coupon exists and is active
   - Checks expiration and minimum order value
   - Stores coupon code in cart

### Data Structure
```json
{
  "id": 123,
  "userId": 45,
  "items": [
    {
      "id": "product-123-1234567890",
      "productId": "123",
      "quantity": 2,
      "price": 499.99
    }
  ],
  "couponCode": "SAVE50",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### Cart Persistence
- Stored in `carts` table
- Items stored as JSONB array
- Prices are frozen at add-time (not real-time)
- Cart cleared after order creation

---

## 5. ORDER FLOW

### Order Creation Process
1. **User adds items** to cart
2. **Apply coupon** (optional)
3. **Create Order** - `POST /orders`
   - Validates cart is not empty
   - Copies items from cart to order
   - Calculates subtotal, coupon discount, total
   - Sets status: PENDING
   - Sets estimated delivery: 2 days from now
   - Sets paymentStatus: PAID (assumes payment collected on frontend)
   - Creates tracking entry with delivery coordinates
   - **Clears cart** automatically
   - **Creates notification** for user

### Order Statuses (Workflow)
```
PENDING 
  ↓
CONFIRMED → PROCESSING → PACKED → OUT_FOR_DELIVERY → DELIVERED
                                         ↓
                                   CANCELLED
```

**Alternative Pickup Flow:**
```
PENDING → CONFIRMED → PROCESSING → PACKED → PICKUP_READY → PICKED_UP
```

### Order Data Structure
```json
{
  "id": 1,
  "userId": 45,
  "items": [
    {
      "id": "product-123-1234567890",
      "productId": "123",
      "quantity": 2,
      "price": 499.99,
      "total": 999.98,
      "productName": "Product Name",
      "productImage": "https://..."
    }
  ],
  "status": "PENDING",
  "deliveryType": "DELIVERY",
  "deliveryAddress": {
    "lat": 28.7041,
    "lng": 77.1025,
    "street": "...",
    "city": "Delhi"
  },
  "subtotal": "999.98",
  "discount": "0",
  "couponDiscount": "0",
  "total": "999.98",
  "couponCode": null,
  "deliveryAgentId": null,
  "paymentStatus": "PAID",
  "estimatedDelivery": "2024-01-17T10:30:00Z",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### Admin Order Management
- `GET /orders` - Filter by status, pagination
- `PUT /orders/:orderId` - Update status
- `POST /orders/:orderId/assign-delivery-agent` - Assign agent

### Delivery Agent View
- `GET /orders/delivery-agent` - Orders assigned to agent
- Only sees orders where `deliveryAgentId = userId`

---

## 6. ADMIN PAGES

**Location**: [artifacts/gupta-enterprises/src/pages/admin/](artifacts/gupta-enterprises/src/pages/admin/)

### Available Admin Features

#### 1. **AdminDashboard** - [AdminDashboard.tsx](artifacts/gupta-enterprises/src/pages/admin/AdminDashboard.tsx)
- Total users count
- Total orders count
- Total products count
- Total revenue
- Active coupons count
- Revenue analytics chart (area chart by time period)
- Order statistics by status (bar chart)
- All metrics support period filtering

#### 2. **AdminOrders** - [AdminOrders.tsx](artifacts/gupta-enterprises/src/pages/admin/AdminOrders.tsx)
- View all orders with status filter
- Update order status from dropdown
- Assign delivery agents to orders
- View order tracking for OUT_FOR_DELIVERY orders
- See agent contact info (name, phone)
- Pagination support

#### 3. **AdminProducts** - [AdminProducts.tsx](artifacts/gupta-enterprises/src/pages/admin/AdminProducts.tsx)
- Create new products with images
- Edit existing products
- Delete products
- Upload images
- Search and filter products
- Assign categories

#### 4. **AdminCategories** - [AdminCategories.tsx](artifacts/gupta-enterprises/src/pages/admin/AdminCategories.tsx)
- Manage product categories
- Add new categories
- Edit category names/slugs
- Delete categories

#### 5. **AdminUsers** - [AdminUsers.tsx](artifacts/gupta-enterprises/src/pages/admin/AdminUsers.tsx)
- List all users with role filtering
- Change user roles (USER → ADMIN, DELIVERY_AGENT)
- Activate/deactivate users
- Pagination support

#### 6. **AdminCoupons** - [AdminCoupons.tsx](artifacts/gupta-enterprises/src/pages/admin/AdminCoupons.tsx)
- Create coupons with:
  - Code, description
  - Discount type (FLAT or PERCENTAGE)
  - Discount value
  - Min order value requirement
  - Max discount cap
  - First-order restriction
  - Usage limits
  - Expiration date
- Edit active coupons
- Delete coupons
- View usage statistics

### Admin Layout
[AdminLayout.tsx](artifacts/gupta-enterprises/src/pages/admin/AdminLayout.tsx)
- Role-based access control (checks role === "ADMIN")
- Sidebar navigation with 6 main sections
- Profile refresh button
- Redirects to home if user lacks admin access

---

## 7. REAL-TIME CAPABILITIES

### Current Status: **NO WEBSOCKET/REAL-TIME**

#### What's Currently Implemented:
1. **Tracking Updates** - Polling-based (not real-time)
   - Delivery agents update location via `PUT /tracking/:orderId/location`
   - Customers fetch tracking via `GET /tracking/:orderId`
   - Frontend must poll (manual refresh or interval)

2. **Notifications** - Pull-based (not real-time)
   - Created on: order placement, status updates, coupon creation
   - Retrieved via `GET /notifications`
   - Frontend must poll or user manually refreshes
   - Stored in database, not pushed to client

3. **Order Status Updates** - Manual fetch
   - Admin updates via `PUT /orders/:orderId`
   - Customers must refresh to see updates
   - No server-sent events or WebSocket broadcast

### Missing Real-Time Features:
- ❌ WebSocket connections (no socket.io, ws, or similar)
- ❌ Server-Sent Events (SSE)
- ❌ Live delivery tracking push
- ❌ Instant notifications to clients
- ❌ Real-time order status notifications
- ❌ Live chat/agent communication

### To Implement Real-Time:
Would need to add:
1. **Socket.io** or **ws** package
2. Connection manager for active users
3. Event emitters on order/tracking updates
4. Client-side socket listeners
5. Possible pub/sub solution (Redis) for multi-instance support

---

## 8. TECH STACK SUMMARY

### Backend (API)
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js 5
- **Database**: PostgreSQL with Drizzle ORM
- **Validation**: Zod schemas
- **Logging**: Pino
- **Authentication**: Firebase JWT validation
- **CORS**: Enabled

### Frontend (React)
- **Framework**: React + TypeScript
- **Build Tool**: Vite
- **UI Library**: Custom components (shadcn-style)
- **HTTP Client**: React Query (TanStack Query)
- **Auth Context**: Firebase Context
- **Icons**: Lucide React
- **Charts**: Recharts
- **Routing**: Wouter

### Database
- **Type**: PostgreSQL
- **ORM**: Drizzle ORM
- **Schemas**: Zod with Drizzle schema generation
- **Migrations**: Drizzle migrations

### Workspace Setup
- **Monorepo**: pnpm workspaces
- **Packages**:
  - `@workspace/api-server` - Express API
  - `@workspace/api-zod` - Shared Zod schemas
  - `@workspace/api-client-react` - Generated React hooks for API
  - `@workspace/db` - Shared database schema
  - `gupta-enterprises` - Main React app
  - `mockup-sandbox` - Mockup preview (Vite)

---

## 9. KEY FILES REFERENCE

### API Routes
| Feature | File |
|---------|------|
| Auth | [auth.ts](artifacts/api-server/src/routes/auth.ts) |
| Products | [products.ts](artifacts/api-server/src/routes/products.ts) |
| Cart | [cart.ts](artifacts/api-server/src/routes/cart.ts) |
| Orders | [orders.ts](artifacts/api-server/src/routes/orders.ts) |
| Categories | [categories.ts](artifacts/api-server/src/routes/categories.ts) |
| Coupons | [coupons.ts](artifacts/api-server/src/routes/coupons.ts) |
| Reviews | [reviews.ts](artifacts/api-server/src/routes/reviews.ts) |
| Tracking | [tracking.ts](artifacts/api-server/src/routes/tracking.ts) |
| Users | [users.ts](artifacts/api-server/src/routes/users.ts) |
| Notifications | [notifications.ts](artifacts/api-server/src/routes/notifications.ts) |
| Analytics | [analytics.ts](artifacts/api-server/src/routes/analytics.ts) |

### Database Schemas
| Table | File |
|-------|------|
| Users | [users.ts](lib/db/src/schema/users.ts) |
| Products | [products.ts](lib/db/src/schema/products.ts) |
| Categories | [categories.ts](lib/db/src/schema/categories.ts) |
| Carts | [carts.ts](lib/db/src/schema/carts.ts) |
| Orders | [orders.ts](lib/db/src/schema/orders.ts) |
| Coupons | [coupons.ts](lib/db/src/schema/coupons.ts) |
| Tracking | [tracking.ts](lib/db/src/schema/tracking.ts) |
| Reviews | [reviews.ts](lib/db/src/schema/reviews.ts) |
| Notifications | [notifications.ts](lib/db/src/schema/notifications.ts) |

### Admin Pages
| Feature | File |
|---------|------|
| Dashboard | [AdminDashboard.tsx](artifacts/gupta-enterprises/src/pages/admin/AdminDashboard.tsx) |
| Orders | [AdminOrders.tsx](artifacts/gupta-enterprises/src/pages/admin/AdminOrders.tsx) |
| Products | [AdminProducts.tsx](artifacts/gupta-enterprises/src/pages/admin/AdminProducts.tsx) |
| Categories | [AdminCategories.tsx](artifacts/gupta-enterprises/src/pages/admin/AdminCategories.tsx) |
| Users | [AdminUsers.tsx](artifacts/gupta-enterprises/src/pages/admin/AdminUsers.tsx) |
| Coupons | [AdminCoupons.tsx](artifacts/gupta-enterprises/src/pages/admin/AdminCoupons.tsx) |
| Layout | [AdminLayout.tsx](artifacts/gupta-enterprises/src/pages/admin/AdminLayout.tsx) |

### Core Files
| Component | File |
|-----------|------|
| Auth Middleware | [auth.ts](artifacts/api-server/src/middlewares/auth.ts) |
| App Setup | [app.ts](artifacts/api-server/src/app.ts) |
| Route Aggregation | [routes/index.ts](artifacts/api-server/src/routes/index.ts) |

---

## 10. QUICK NOTES

- **Cart clearing**: Automatic after order creation
- **Prices**: Captured at add-to-cart time (not dynamic)
- **Order creation**: Immediately sets paymentStatus to PAID (frontend handles payment)
- **Delivery estimation**: Fixed 2 days from order creation
- **Product reviews**: Only for delivered orders, one review per user per product
- **Notifications**: Created but only retrievable by polling
- **Admin analytics**: Period-based (supports month view with growth metrics)
- **Stock management**: No automatic stock deduction on order - must be handled separately
- **Coupon usage**: Tracked with usageCount, can have usage limits

