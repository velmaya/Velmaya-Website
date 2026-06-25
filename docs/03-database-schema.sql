-- Velmaya — Supabase (PostgreSQL) Schema
-- Milestone 1 deliverable. Designed for ~20-50 SKUs at launch, scalable to thousands.
-- Storage split: this DB stores product/order/customer DATA only.
-- All images/media live in Cloudflare R2; this schema stores only their URLs + metadata.

create extension if not exists "uuid-ossp";

-- ============================================================
-- CATALOGUE
-- ============================================================

create table categories (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,              -- 'kurtis' | 'kurti-sets' | 'short-kurtis' | 'co-ord-sets'
  name text not null,
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table collections (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,              -- e.g. 'launch-edit'
  name text not null,
  description text,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table products (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  name text not null,
  description text,
  category_id uuid not null references categories(id),
  fabric text,
  care_instructions text,
  is_published boolean not null default false,
  base_price numeric(10,2) not null,      -- display/reference price; actual price can be overridden per variant
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table product_collections (
  product_id uuid not null references products(id) on delete cascade,
  collection_id uuid not null references collections(id) on delete cascade,
  primary key (product_id, collection_id)
);

-- Fashion inventory must be modeled per-variant (size), not per-product.
create table product_variants (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products(id) on delete cascade,
  size text not null check (size in ('XS','S','M','L','XL','2XL')),
  sku text unique not null,
  price numeric(10,2) not null,
  sale_price numeric(10,2),
  stock_qty int not null default 0 check (stock_qty >= 0),
  created_at timestamptz not null default now(),
  unique (product_id, size)
);

-- Optional non-size variation axis (e.g. colorway) for future use.
create table product_options (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products(id) on delete cascade,
  option_name text not null,              -- e.g. 'Color'
  option_value text not null              -- e.g. 'Rust Orange'
);

-- All image binaries live in Cloudflare R2; this table stores only the resulting URL + metadata.
create table product_images (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete cascade, -- null = applies to all variants
  r2_url text not null,
  alt_text text,
  shot_type text check (shot_type in ('front','back','side','fabric_closeup','detail_closeup','lifestyle')),
  display_order int not null default 0
);

-- ============================================================
-- CUSTOMERS & ORDERS
-- ============================================================

create table customers (
  id uuid primary key default uuid_generate_v4(),
  email text unique,
  phone text unique,
  full_name text,
  created_at timestamptz not null default now()
);

-- Captures contact info before payment so an abandoned-checkout list exists
-- even before recovery automation is built (per audit recommendation).
create table checkout_sessions (
  id uuid primary key default uuid_generate_v4(),
  email text,
  phone text,
  cart_snapshot jsonb not null,           -- [{variant_id, qty, price}, ...]
  converted_order_id uuid,                -- set once this session results in a paid order
  created_at timestamptz not null default now()
);

create table orders (
  id uuid primary key default uuid_generate_v4(),
  order_number text unique not null,      -- human-friendly, e.g. VLM-000123
  customer_id uuid references customers(id),
  checkout_session_id uuid references checkout_sessions(id),
  status text not null default 'pending_payment'
    check (status in ('pending_payment','paid','payment_failed','cancelled','fulfilled','refunded')),
  shipping_name text not null,
  shipping_phone text not null,
  shipping_address_line1 text not null,
  shipping_address_line2 text,
  shipping_city text not null,
  shipping_state text not null,
  shipping_pincode text not null,
  subtotal numeric(10,2) not null,
  shipping_fee numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  razorpay_order_id text,
  razorpay_payment_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  variant_id uuid not null references product_variants(id),
  product_name_snapshot text not null,    -- preserve display name at time of purchase
  size_snapshot text not null,
  unit_price numeric(10,2) not null,
  quantity int not null check (quantity > 0)
);

-- Prevents overselling the last unit of a size to concurrent buyers.
-- Flow: order created -> reservation row inserted -> stock held.
-- On payment success: reservation marked 'confirmed', stock_qty decremented permanently (via inventory_movements).
-- On payment failure/timeout: reservation marked 'released', held stock returned.
create table inventory_reservations (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  variant_id uuid not null references product_variants(id),
  quantity int not null check (quantity > 0),
  status text not null default 'held'
    check (status in ('held','confirmed','released')),
  expires_at timestamptz not null,        -- e.g. now() + 15 minutes; a cleanup job releases expired holds
  created_at timestamptz not null default now()
);

create table inventory_movements (
  id uuid primary key default uuid_generate_v4(),
  variant_id uuid not null references product_variants(id),
  change_qty int not null,                -- negative = decrement (sale), positive = restock
  reason text not null check (reason in ('sale','restock','return','adjustment')),
  order_id uuid references orders(id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- ENGAGEMENT
-- ============================================================

create table reviews (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products(id) on delete cascade,
  customer_id uuid references customers(id),
  rating int not null check (rating between 1 and 5),
  body text,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table coupons (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,
  discount_type text not null check (discount_type in ('percentage','flat')),
  discount_value numeric(10,2) not null,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  max_uses int,
  used_count int not null default 0
);

create table newsletter_subscribers (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  subscribed_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index idx_products_category on products(category_id);
create index idx_variants_product on product_variants(product_id);
create index idx_images_product on product_images(product_id);
create index idx_orders_customer on orders(customer_id);
create index idx_order_items_order on order_items(order_id);
create index idx_reservations_variant_status on inventory_reservations(variant_id, status);
create index idx_reviews_product on reviews(product_id, is_published);

-- ============================================================
-- NOTES
-- ============================================================
-- Row Level Security (RLS): enable on customer-facing tables (orders, customers,
-- checkout_sessions) once auth is introduced; at launch, all writes go through
-- server-side routes using the service role key, so RLS can stay permissive/off
-- for now and be tightened when accounts/auth are built (see backlog).
