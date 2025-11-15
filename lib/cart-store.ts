// lib/cart-store.ts
import { create } from "zustand";

export type CartItem = {
  id: number;
  name: string;
  priceLabel: string; // ejemplo: "$9.990"
  image?: string;
  quantity: number;
};

type CartState = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (id: number) => void;
  clearCart: () => void;
  updateQuantity: (id: number, quantity: number) => void;
  total: () => number;
};

function parsePrice(priceLabel: string): number {
  // "$27.990" → 27990
  const cleaned = priceLabel.replace("$", "").replace(/\./g, "").replace(",", ".");
  const value = Number(cleaned);
  return Number.isNaN(value) ? 0 : value;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  addItem: (item) =>
    set((state) => {
      const exists = state.items.find((i) => i.id === item.id);
      if (exists) {
        return {
          items: state.items.map((i) =>
            i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
          ),
        };
      }
      return {
        items: [...state.items, { ...item, quantity: 1 }],
      };
    }),

  removeItem: (id) =>
    set((state) => ({
      items: state.items.filter((i) => i.id !== id),
    })),

  clearCart: () => set({ items: [] }),

  updateQuantity: (id, quantity) =>
    set((state) => ({
      items: state.items
        .map((i) =>
          i.id === id ? { ...i, quantity: Math.max(1, quantity) } : i
        )
        .filter((i) => i.quantity > 0),
    })),

  total: () => {
    const { items } = get();
    return items.reduce(
      (sum, item) => sum + parsePrice(item.priceLabel) * item.quantity,
      0
    );
  },
}));
