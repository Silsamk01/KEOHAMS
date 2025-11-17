# KEOHAMS API Documentation

**Version:** 1.0.0  
**Base URL:** `https://keohams.com/api`  
**Last Updated:** November 16, 2025

---

## Table of Contents

1. [Authentication](#authentication)
2. [Users & Profile](#users--profile)
3. [Products](#products)
4. [Categories](#categories)
5. [Shopping Cart](#shopping-cart)
6. [Orders](#orders)
7. [Payments](#payments)
8. [Blog](#blog)
9. [Affiliates](#affiliates)
10. [KYC Verification](#kyc-verification)
11. [Quotations](#quotations)
12. [Notifications](#notifications)
13. [Security](#security)
14. [Error Codes](#error-codes)
15. [Rate Limiting](#rate-limiting)

---

## Authentication

All authenticated endpoints require a valid session cookie or Bearer token.

### Register New User

**Endpoint:** `POST /api/auth/register`

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecureP@ss123",
  "password_confirmation": "SecureP@ss123",
  "phone": "+2348012345678",
  "referral_code": "KEOH123" // Optional
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Registration successful. Please verify your email.",
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+2348012345678",
      "role": "customer",
      "status": "pending",
      "email_verified_at": null,
      "created_at": "2025-11-16T10:30:00Z"
    },
    "token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
  }
}
```

### Login

**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecureP@ss123",
  "remember": true // Optional
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "role": "customer",
      "status": "active",
      "email_verified_at": "2025-11-16T10:35:00Z"
    },
    "token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
    "expires_in": 86400
  }
}
```

### Verify Email

**Endpoint:** `GET /api/auth/verify-email/{token}`

**Response (200):**
```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

### Forgot Password

**Endpoint:** `POST /api/auth/forgot-password`

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset link sent to your email"
}
```

### Reset Password

**Endpoint:** `POST /api/auth/reset-password`

**Request Body:**
```json
{
  "token": "reset_token_here",
  "email": "john@example.com",
  "password": "NewSecureP@ss123",
  "password_confirmation": "NewSecureP@ss123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset successful"
}
```

### Logout

**Endpoint:** `POST /api/auth/logout`  
**Authentication:** Required

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## Users & Profile

### Get Current User Profile

**Endpoint:** `GET /api/user/profile`  
**Authentication:** Required

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+2348012345678",
    "role": "customer",
    "status": "active",
    "avatar": "https://keohams.com/storage/avatars/user1.jpg",
    "kyc_status": "verified",
    "two_factor_enabled": false,
    "affiliate_code": "JOHN123",
    "created_at": "2025-11-16T10:30:00Z",
    "updated_at": "2025-11-16T12:00:00Z"
  }
}
```

### Update Profile

**Endpoint:** `PUT /api/user/profile`  
**Authentication:** Required

**Request Body:**
```json
{
  "name": "John Updated",
  "phone": "+2348098765432",
  "address": "123 Main St, Lagos, Nigeria",
  "city": "Lagos",
  "state": "Lagos",
  "country": "Nigeria"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "id": 1,
    "name": "John Updated",
    "email": "john@example.com",
    "phone": "+2348098765432",
    "address": "123 Main St, Lagos, Nigeria",
    "city": "Lagos",
    "state": "Lagos",
    "country": "Nigeria"
  }
}
```

### Change Password

**Endpoint:** `POST /api/user/change-password`  
**Authentication:** Required

**Request Body:**
```json
{
  "current_password": "OldP@ss123",
  "password": "NewSecureP@ss123",
  "password_confirmation": "NewSecureP@ss123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

### Enable Two-Factor Authentication

**Endpoint:** `POST /api/user/two-factor/enable`  
**Authentication:** Required

**Response (200):**
```json
{
  "success": true,
  "message": "Two-factor authentication enabled",
  "data": {
    "qr_code": "data:image/png;base64,iVBORw0KGgo...",
    "secret": "JBSWY3DPEHPK3PXP",
    "backup_codes": [
      "12345678",
      "87654321",
      "11223344",
      "44332211"
    ]
  }
}
```

### Verify Two-Factor Code

**Endpoint:** `POST /api/user/two-factor/verify`  
**Authentication:** Required

**Request Body:**
```json
{
  "code": "123456"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Two-factor authentication verified"
}
```

---

## Products

### Get All Products

**Endpoint:** `GET /api/products`

**Query Parameters:**
- `page` (integer): Page number (default: 1)
- `per_page` (integer): Items per page (default: 15, max: 100)
- `search` (string): Search in name and description
- `category_id` (integer): Filter by category
- `status` (string): Filter by status (active, inactive, out_of_stock)
- `featured` (boolean): Filter featured products
- `min_price` (decimal): Minimum price filter
- `max_price` (decimal): Maximum price filter
- `sort_by` (string): Sort field (name, price, created_at)
- `sort_order` (string): Sort direction (asc, desc)

**Example:** `GET /api/products?category_id=1&featured=true&sort_by=price&sort_order=asc`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": 1,
        "name": "Premium Product",
        "slug": "premium-product",
        "description": "High quality product description",
        "short_description": "Brief description",
        "price": 15000.00,
        "sale_price": 12000.00,
        "discount_percentage": 20,
        "sku": "PROD-001",
        "stock_quantity": 50,
        "featured": true,
        "status": "active",
        "category": {
          "id": 1,
          "name": "Electronics",
          "slug": "electronics"
        },
        "images": [
          {
            "id": 1,
            "url": "https://keohams.com/storage/products/prod1-main.jpg",
            "is_primary": true
          },
          {
            "id": 2,
            "url": "https://keohams.com/storage/products/prod1-alt.jpg",
            "is_primary": false
          }
        ],
        "rating": 4.5,
        "reviews_count": 23,
        "created_at": "2025-11-16T10:00:00Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "per_page": 15,
      "total": 100,
      "total_pages": 7,
      "has_more": true
    }
  }
}
```

### Get Single Product

**Endpoint:** `GET /api/products/{id}`  
**Alternative:** `GET /api/products/slug/{slug}`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Premium Product",
    "slug": "premium-product",
    "description": "Detailed product description...",
    "short_description": "Brief description",
    "price": 15000.00,
    "sale_price": 12000.00,
    "discount_percentage": 20,
    "sku": "PROD-001",
    "stock_quantity": 50,
    "weight": 2.5,
    "dimensions": "30x20x10 cm",
    "featured": true,
    "status": "active",
    "meta_title": "Premium Product - KEOHAMS",
    "meta_description": "SEO description",
    "category": {
      "id": 1,
      "name": "Electronics",
      "slug": "electronics"
    },
    "images": [...],
    "specifications": {
      "Brand": "Sony",
      "Model": "XYZ-2025",
      "Warranty": "1 Year"
    },
    "related_products": [...],
    "rating": 4.5,
    "reviews_count": 23,
    "reviews": [...],
    "created_at": "2025-11-16T10:00:00Z",
    "updated_at": "2025-11-16T11:00:00Z"
  }
}
```

### Create Product (Admin Only)

**Endpoint:** `POST /api/products`  
**Authentication:** Required (Admin)

**Request Body (multipart/form-data):**
```json
{
  "name": "New Product",
  "description": "Product description",
  "short_description": "Brief description",
  "price": 15000.00,
  "sale_price": 12000.00,
  "sku": "PROD-002",
  "stock_quantity": 100,
  "category_id": 1,
  "featured": true,
  "status": "active",
  "images[]": [File, File], // Multiple image files
  "specifications": {
    "Brand": "Sony",
    "Model": "ABC-2025"
  }
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Product created successfully",
  "data": {
    "id": 2,
    "name": "New Product",
    ...
  }
}
```

### Update Product (Admin Only)

**Endpoint:** `PUT /api/products/{id}`  
**Authentication:** Required (Admin)

**Response (200):**
```json
{
  "success": true,
  "message": "Product updated successfully",
  "data": {...}
}
```

### Delete Product (Admin Only)

**Endpoint:** `DELETE /api/products/{id}`  
**Authentication:** Required (Admin)

**Response (200):**
```json
{
  "success": true,
  "message": "Product deleted successfully"
}
```

---

## Categories

### Get All Categories

**Endpoint:** `GET /api/categories`

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Electronics",
      "slug": "electronics",
      "description": "Electronic products",
      "image": "https://keohams.com/storage/categories/electronics.jpg",
      "parent_id": null,
      "products_count": 45,
      "status": "active",
      "children": [
        {
          "id": 2,
          "name": "Smartphones",
          "slug": "smartphones",
          "parent_id": 1,
          "products_count": 20
        }
      ]
    }
  ]
}
```

### Get Category with Products

**Endpoint:** `GET /api/categories/{id}/products`

**Query Parameters:** Same as products endpoint

**Response (200):**
```json
{
  "success": true,
  "data": {
    "category": {
      "id": 1,
      "name": "Electronics",
      "slug": "electronics",
      "description": "Electronic products"
    },
    "products": [...],
    "pagination": {...}
  }
}
```

---

## Shopping Cart

### Get Cart

**Endpoint:** `GET /api/cart`  
**Authentication:** Required

**Response (200):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "product_id": 1,
        "product_name": "Premium Product",
        "product_image": "https://keohams.com/storage/products/prod1.jpg",
        "quantity": 2,
        "price": 12000.00,
        "subtotal": 24000.00
      }
    ],
    "subtotal": 24000.00,
    "tax": 1800.00,
    "shipping": 2000.00,
    "total": 27800.00,
    "items_count": 2
  }
}
```

### Add to Cart

**Endpoint:** `POST /api/cart/add`  
**Authentication:** Required

**Request Body:**
```json
{
  "product_id": 1,
  "quantity": 2
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Product added to cart",
  "data": {
    "cart": {...}
  }
}
```

### Update Cart Item

**Endpoint:** `PUT /api/cart/items/{id}`  
**Authentication:** Required

**Request Body:**
```json
{
  "quantity": 3
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Cart updated",
  "data": {...}
}
```

### Remove from Cart

**Endpoint:** `DELETE /api/cart/items/{id}`  
**Authentication:** Required

**Response (200):**
```json
{
  "success": true,
  "message": "Item removed from cart"
}
```

### Clear Cart

**Endpoint:** `POST /api/cart/clear`  
**Authentication:** Required

**Response (200):**
```json
{
  "success": true,
  "message": "Cart cleared"
}
```

---

## Orders

### Get User Orders

**Endpoint:** `GET /api/orders`  
**Authentication:** Required

**Query Parameters:**
- `page` (integer)
- `per_page` (integer)
- `status` (string): pending, processing, shipped, delivered, cancelled

**Response (200):**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": 1,
        "order_number": "ORD-20251116-001",
        "status": "processing",
        "payment_status": "paid",
        "payment_method": "paystack",
        "subtotal": 24000.00,
        "tax": 1800.00,
        "shipping": 2000.00,
        "total": 27800.00,
        "items": [
          {
            "product_id": 1,
            "product_name": "Premium Product",
            "quantity": 2,
            "price": 12000.00,
            "subtotal": 24000.00
          }
        ],
        "shipping_address": {
          "name": "John Doe",
          "phone": "+2348012345678",
          "address": "123 Main St",
          "city": "Lagos",
          "state": "Lagos",
          "country": "Nigeria"
        },
        "created_at": "2025-11-16T14:00:00Z",
        "updated_at": "2025-11-16T14:30:00Z"
      }
    ],
    "pagination": {...}
  }
}
```

### Get Single Order

**Endpoint:** `GET /api/orders/{id}`  
**Authentication:** Required

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "order_number": "ORD-20251116-001",
    "status": "processing",
    "payment_status": "paid",
    "tracking_number": "TRK123456789",
    "items": [...],
    "shipping_address": {...},
    "billing_address": {...},
    "timeline": [
      {
        "status": "pending",
        "timestamp": "2025-11-16T14:00:00Z"
      },
      {
        "status": "processing",
        "timestamp": "2025-11-16T14:30:00Z"
      }
    ],
    "notes": "Handle with care",
    "created_at": "2025-11-16T14:00:00Z"
  }
}
```

### Create Order

**Endpoint:** `POST /api/orders`  
**Authentication:** Required

**Request Body:**
```json
{
  "shipping_address": {
    "name": "John Doe",
    "phone": "+2348012345678",
    "address": "123 Main St",
    "city": "Lagos",
    "state": "Lagos",
    "country": "Nigeria",
    "postal_code": "100001"
  },
  "billing_address": {
    // Same structure as shipping_address
    // Or set "same_as_shipping": true
  },
  "payment_method": "paystack",
  "notes": "Please deliver in the morning"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "order": {...},
    "payment_url": "https://checkout.paystack.com/xyz123" // If payment required
  }
}
```

### Cancel Order

**Endpoint:** `POST /api/orders/{id}/cancel`  
**Authentication:** Required

**Request Body:**
```json
{
  "reason": "Changed my mind"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Order cancelled successfully"
}
```

---

## Payments

### Initialize Payment

**Endpoint:** `POST /api/payments/initialize`  
**Authentication:** Required

**Request Body:**
```json
{
  "order_id": 1,
  "payment_method": "paystack",
  "callback_url": "https://keohams.com/payment/callback"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "authorization_url": "https://checkout.paystack.com/xyz123",
    "access_code": "xyz123",
    "reference": "REF-20251116-001"
  }
}
```

### Verify Payment

**Endpoint:** `GET /api/payments/verify/{reference}`  
**Authentication:** Required

**Response (200):**
```json
{
  "success": true,
  "message": "Payment verified successfully",
  "data": {
    "reference": "REF-20251116-001",
    "status": "success",
    "amount": 27800.00,
    "order_id": 1,
    "paid_at": "2025-11-16T14:35:00Z"
  }
}
```

---

## Blog

### Get All Posts

**Endpoint:** `GET /api/blog/posts`

**Query Parameters:**
- `page`, `per_page`
- `category_id`
- `search`
- `published` (boolean)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "posts": [
      {
        "id": 1,
        "title": "Blog Post Title",
        "slug": "blog-post-title",
        "excerpt": "Short excerpt...",
        "content": "Full content...",
        "featured_image": "https://keohams.com/storage/blog/post1.jpg",
        "author": {
          "id": 1,
          "name": "Admin User"
        },
        "category": {
          "id": 1,
          "name": "Technology"
        },
        "tags": ["tech", "innovation"],
        "published_at": "2025-11-16T10:00:00Z",
        "views_count": 1250,
        "comments_count": 15
      }
    ],
    "pagination": {...}
  }
}
```

### Get Single Post

**Endpoint:** `GET /api/blog/posts/{slug}`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Blog Post Title",
    "slug": "blog-post-title",
    "content": "Full HTML content...",
    "featured_image": "https://keohams.com/storage/blog/post1.jpg",
    "author": {...},
    "category": {...},
    "tags": [...],
    "related_posts": [...],
    "comments": [...],
    "published_at": "2025-11-16T10:00:00Z",
    "views_count": 1251
  }
}
```

### Create Comment

**Endpoint:** `POST /api/blog/posts/{id}/comments`  
**Authentication:** Required

**Request Body:**
```json
{
  "content": "Great post! Very informative.",
  "parent_id": null // Optional, for replies
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Comment added successfully",
  "data": {
    "id": 1,
    "content": "Great post! Very informative.",
    "user": {...},
    "created_at": "2025-11-16T15:00:00Z"
  }
}
```

---

## Affiliates

### Get Affiliate Dashboard

**Endpoint:** `GET /api/affiliates/dashboard`  
**Authentication:** Required

**Response (200):**
```json
{
  "success": true,
  "data": {
    "affiliate_code": "JOHN123",
    "affiliate_link": "https://keohams.com?ref=JOHN123",
    "stats": {
      "total_referrals": 25,
      "active_referrals": 20,
      "total_earnings": 125000.00,
      "pending_earnings": 15000.00,
      "paid_earnings": 110000.00,
      "this_month_earnings": 25000.00
    },
    "referrals": [
      {
        "id": 1,
        "name": "Jane Doe",
        "email": "jane@example.com",
        "level": 1,
        "status": "active",
        "total_orders": 5,
        "commission_earned": 5000.00,
        "joined_at": "2025-10-16T10:00:00Z"
      }
    ],
    "commissions": [
      {
        "id": 1,
        "order_id": 100,
        "referral_user": "Jane Doe",
        "order_amount": 50000.00,
        "commission_rate": 10,
        "commission_amount": 5000.00,
        "level": 1,
        "status": "paid",
        "paid_at": "2025-11-01T10:00:00Z",
        "created_at": "2025-10-20T14:00:00Z"
      }
    ]
  }
}
```

### Request Payout

**Endpoint:** `POST /api/affiliates/payout`  
**Authentication:** Required

**Request Body:**
```json
{
  "amount": 50000.00,
  "payment_method": "bank_transfer",
  "bank_details": {
    "bank_name": "First Bank",
    "account_number": "1234567890",
    "account_name": "John Doe"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Payout request submitted successfully",
  "data": {
    "id": 1,
    "amount": 50000.00,
    "status": "pending",
    "requested_at": "2025-11-16T16:00:00Z"
  }
}
```

---

## KYC Verification

### Get KYC Status

**Endpoint:** `GET /api/kyc/status`  
**Authentication:** Required

**Response (200):**
```json
{
  "success": true,
  "data": {
    "status": "pending", // pending, verified, rejected
    "submitted_at": "2025-11-16T12:00:00Z",
    "verified_at": null,
    "rejection_reason": null,
    "documents": [
      {
        "type": "id_card",
        "status": "verified"
      },
      {
        "type": "selfie",
        "status": "pending"
      }
    ]
  }
}
```

### Submit KYC Documents

**Endpoint:** `POST /api/kyc/submit`  
**Authentication:** Required

**Request Body (multipart/form-data):**
```json
{
  "document_type": "passport", // passport, id_card, drivers_license
  "document_number": "A12345678",
  "id_front": File,
  "id_back": File,
  "selfie": File,
  "proof_of_address": File // Optional
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "KYC documents submitted successfully",
  "data": {
    "status": "pending",
    "submitted_at": "2025-11-16T12:00:00Z"
  }
}
```

---

## Quotations

### Get User Quotations

**Endpoint:** `GET /api/quotations`  
**Authentication:** Required

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "reference": "QUO-20251116-001",
      "title": "Bulk Order Request",
      "description": "Request for 100 units",
      "status": "pending", // pending, approved, rejected
      "items": [
        {
          "product_id": 1,
          "product_name": "Premium Product",
          "quantity": 100,
          "unit_price": 12000.00,
          "total": 1200000.00
        }
      ],
      "subtotal": 1200000.00,
      "discount": 120000.00,
      "total": 1080000.00,
      "valid_until": "2025-11-30T23:59:59Z",
      "admin_notes": "10% discount applied",
      "created_at": "2025-11-16T10:00:00Z"
    }
  ]
}
```

### Create Quotation Request

**Endpoint:** `POST /api/quotations`  
**Authentication:** Required

**Request Body:**
```json
{
  "title": "Bulk Order Request",
  "description": "I need 100 units for a corporate event",
  "items": [
    {
      "product_id": 1,
      "quantity": 100
    },
    {
      "product_id": 2,
      "quantity": 50
    }
  ],
  "delivery_date": "2025-12-01"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Quotation request submitted successfully",
  "data": {
    "id": 1,
    "reference": "QUO-20251116-001",
    "status": "pending"
  }
}
```

### Accept Quotation

**Endpoint:** `POST /api/quotations/{id}/accept`  
**Authentication:** Required

**Response (200):**
```json
{
  "success": true,
  "message": "Quotation accepted. Order created.",
  "data": {
    "order_id": 150,
    "order_number": "ORD-20251116-150"
  }
}
```

---

## Notifications

### Get Notifications

**Endpoint:** `GET /api/notifications`  
**Authentication:** Required

**Query Parameters:**
- `page`, `per_page`
- `unread` (boolean)
- `type` (string)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": 1,
        "type": "order_status",
        "title": "Order Shipped",
        "message": "Your order #ORD-20251116-001 has been shipped",
        "data": {
          "order_id": 1,
          "order_number": "ORD-20251116-001"
        },
        "is_read": false,
        "created_at": "2025-11-16T15:30:00Z"
      }
    ],
    "unread_count": 5,
    "pagination": {...}
  }
}
```

### Mark as Read

**Endpoint:** `PUT /api/notifications/{id}/read`  
**Authentication:** Required

**Response (200):**
```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

### Mark All as Read

**Endpoint:** `POST /api/notifications/read-all`  
**Authentication:** Required

**Response (200):**
```json
{
  "success": true,
  "message": "All notifications marked as read"
}
```

---

## Security

### Get Security Events

**Endpoint:** `GET /api/security/events`  
**Authentication:** Required

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "event_type": "login",
      "ip_address": "192.168.1.1",
      "user_agent": "Mozilla/5.0...",
      "location": "Lagos, Nigeria",
      "status": "success",
      "created_at": "2025-11-16T10:00:00Z"
    }
  ]
}
```

### Get Active Sessions

**Endpoint:** `GET /api/security/sessions`  
**Authentication:** Required

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "session_123",
      "ip_address": "192.168.1.1",
      "user_agent": "Chrome 119.0.0.0",
      "location": "Lagos, Nigeria",
      "is_current": true,
      "last_activity": "2025-11-16T16:00:00Z"
    }
  ]
}
```

### Revoke Session

**Endpoint:** `DELETE /api/security/sessions/{id}`  
**Authentication:** Required

**Response (200):**
```json
{
  "success": true,
  "message": "Session revoked successfully"
}
```

---

## Error Codes

### HTTP Status Codes

- **200 OK:** Request successful
- **201 Created:** Resource created successfully
- **400 Bad Request:** Invalid request parameters
- **401 Unauthorized:** Authentication required
- **403 Forbidden:** Access denied
- **404 Not Found:** Resource not found
- **422 Unprocessable Entity:** Validation failed
- **429 Too Many Requests:** Rate limit exceeded
- **500 Internal Server Error:** Server error

### Error Response Format

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "email": ["The email field is required."],
    "password": ["The password must be at least 8 characters."]
  }
}
```

### Common Error Messages

- `invalid_credentials`: Email or password is incorrect
- `email_not_verified`: Please verify your email address
- `account_inactive`: Your account has been deactivated
- `insufficient_stock`: Product is out of stock
- `invalid_token`: Token is invalid or expired
- `payment_failed`: Payment processing failed
- `kyc_required`: KYC verification required for this action

---

## Rate Limiting

### Limits

- **Authentication endpoints:** 5 requests per minute
- **General API:** 60 requests per minute
- **Admin endpoints:** 120 requests per minute

### Rate Limit Headers

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1700145600
```

### Rate Limit Exceeded Response

```json
{
  "success": false,
  "message": "Too many requests. Please try again later.",
  "retry_after": 60
}
```

---

## Webhooks

### Payment Webhook

**Endpoint:** `POST /api/webhooks/paystack`

**Headers:**
```
X-Paystack-Signature: signature_here
```

**Event Types:**
- `charge.success`
- `charge.failed`
- `transfer.success`

---

## Testing

### Test Credentials

**Customer Account:**
- Email: `test@keohams.com`
- Password: `Test@123`

**Admin Account:**
- Email: `admin@keohams.com`
- Password: `Admin@123`

### Test Payment

**Paystack Test Card:**
- Number: `4084084084084081`
- CVV: `408`
- Expiry: `12/25`
- PIN: `0000`
- OTP: `123456`

---

## Support

**Technical Support:**
- Email: Ohamskenneth08@gmail.com
- Documentation: https://keohams.com/docs
- API Status: https://status.keohams.com

---

**API Version:** 1.0.0  
**Last Updated:** November 16, 2025
