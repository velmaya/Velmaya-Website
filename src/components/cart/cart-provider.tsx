"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { CartItem } from "@/lib/cart/types";
import { cartCount, cartSubtotal } from "@/lib/cart/types";

const STORAGE_KEY = "velmaya.cart.v1";
const MAX_QTY_PER_LINE = 10;

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  isOpen: boolean;
  addItem: (item: CartItem) => void;
  updateQty: (variantId: string, qty: number) => void;
  removeItem: (variantId: string) => void;
  clear: () => void;
  openCart: () => void;
  closeCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within <CartProvider>");
  return ctx;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Load persisted cart once on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw) as CartItem[]);
    } catch {
      // ignore corrupt storage
    }
    setHydrated(true);
  }, []);

  // Persist on change (after hydration, so we don't clobber stored data).
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // storage full / unavailable — non-fatal
    }
  }, [items, hydrated]);

  const addItem = useCallback((item: CartItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.variantId === item.variantId);
      if (existing) {
        return prev.map((i) =>
          i.variantId === item.variantId
            ? { ...i, qty: Math.min(MAX_QTY_PER_LINE, i.qty + item.qty) }
            : i
        );
      }
      return [...prev, { ...item, qty: Math.min(MAX_QTY_PER_LINE, item.qty) }];
    });
    setIsOpen(true);
  }, []);

  const updateQty = useCallback((variantId: string, qty: number) => {
    setItems((prev) =>
      prev.flatMap((i) => {
        if (i.variantId !== variantId) return [i];
        const next = Math.max(0, Math.min(MAX_QTY_PER_LINE, qty));
        return next === 0 ? [] : [{ ...i, qty: next }];
      })
    );
  }, []);

  const removeItem = useCallback((variantId: string) => {
    setItems((prev) => prev.filter((i) => i.variantId !== variantId));
  }, []);

  const clear = useCallback(() => setItems([]), []);
  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count: cartCount(items),
      subtotal: cartSubtotal(items),
      isOpen,
      addItem,
      updateQty,
      removeItem,
      clear,
      openCart,
      closeCart,
    }),
    [items, isOpen, addItem, updateQty, removeItem, clear, openCart, closeCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
