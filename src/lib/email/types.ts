export type OrderEmailItem = {
  productName: string;
  size: string;
  unitPrice: number;
  quantity: number;
};

export type OrderEmailData = {
  orderNumber: string;
  createdAt: string;
  customerEmail: string | null;
  shippingName: string;
  shippingPhone: string;
  shippingAddressLine1: string;
  shippingAddressLine2: string | null;
  shippingCity: string;
  shippingState: string;
  shippingPincode: string;
  subtotal: number;
  shippingFee: number;
  total: number;
  orderNotes: string | null;
  giftMessage: string | null;
  items: OrderEmailItem[];
};
