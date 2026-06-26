// Client-safe surface: types + pure helpers (priceRange, formatINR, isOnSale,
// effectivePrice, totalStock, etc.). Safe to import from client components.
//
// Catalogue DATA FETCHING (Supabase / seed) lives in ./queries and is
// `server-only` — import those functions from "@/lib/products/queries".
export * from "./types";
