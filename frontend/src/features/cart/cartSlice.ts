import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface CartItem {
  id: string;
  medicineId: string;
  name: string;
  genericName: string;
  image?: string;
  slug: string;
  dosageOption: {
    id: string;
    strength: string;
    unit: string;
    price: number;
  };
  quantity: number;
  prescriptionRequired: boolean;
}

interface CartState {
  items: CartItem[];
  promoCode: string | null;
  promoDiscount: number;
}

const initialState: CartState = {
  items: [],
  promoCode: null,
  promoDiscount: 0,
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addToCart: (state, action: PayloadAction<CartItem>) => {
      const existingIndex = state.items.findIndex(
        (item) =>
          item.medicineId === action.payload.medicineId &&
          item.dosageOption.id === action.payload.dosageOption.id
      );

      if (existingIndex >= 0) {
        // Update quantity if item already exists
        state.items[existingIndex].quantity += action.payload.quantity;
        // Cap at 10
        if (state.items[existingIndex].quantity > 10) {
          state.items[existingIndex].quantity = 10;
        }
      } else {
        // Add new item
        state.items.push(action.payload);
      }
    },

    removeFromCart: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((item) => item.id !== action.payload);
    },

    updateQuantity: (state, action: PayloadAction<{ id: string; quantity: number }>) => {
      const item = state.items.find((item) => item.id === action.payload.id);
      if (item) {
        item.quantity = Math.max(1, Math.min(10, action.payload.quantity));
      }
    },

    incrementQuantity: (state, action: PayloadAction<string>) => {
      const item = state.items.find((item) => item.id === action.payload);
      if (item && item.quantity < 10) {
        item.quantity += 1;
      }
    },

    decrementQuantity: (state, action: PayloadAction<string>) => {
      const item = state.items.find((item) => item.id === action.payload);
      if (item && item.quantity > 1) {
        item.quantity -= 1;
      }
    },

    applyPromoCode: (state, action: PayloadAction<{ code: string; discount: number }>) => {
      state.promoCode = action.payload.code;
      state.promoDiscount = action.payload.discount;
    },

    removePromoCode: (state) => {
      state.promoCode = null;
      state.promoDiscount = 0;
    },

    clearCart: (state) => {
      state.items = [];
      state.promoCode = null;
      state.promoDiscount = 0;
    },
  },
});

export const {
  addToCart,
  removeFromCart,
  updateQuantity,
  incrementQuantity,
  decrementQuantity,
  applyPromoCode,
  removePromoCode,
  clearCart,
} = cartSlice.actions;

// Selectors
export const selectCartItems = (state: { cart: CartState }) => state.cart.items;
export const selectCartItemCount = (state: { cart: CartState }) =>
  state.cart.items.reduce((total, item) => total + item.quantity, 0);
export const selectCartSubtotal = (state: { cart: CartState }) =>
  state.cart.items.reduce((total, item) => total + item.dosageOption.price * item.quantity, 0);
export const selectPromoCode = (state: { cart: CartState }) => state.cart.promoCode;
export const selectPromoDiscount = (state: { cart: CartState }) => state.cart.promoDiscount;

export default cartSlice.reducer;