export interface Drink {
  id: string;
  name: string;
  description?: string;
  price: string;
  isAvailable: boolean;
  sortOrder: number;
  categoryId: string;
  category: DrinkCategory;
  ingredients: Array<{
    ingredient: Ingredient;
  }>;
  modifierGroups: Array<{
    modifierGroup: ModifierGroup;
  }>;
}

export interface DrinkCategory {
  id: string;
  name: string;
  sortOrder: number;
  drinks?: Drink[];
}

export interface Ingredient {
  id: string;
  name: string;
  isAvailable: boolean;
}

export interface ModifierGroup {
  id: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  sortOrder: number;
  options: ModifierOption[];
}

export interface ModifierOption {
  id: string;
  name: string;
  priceAdjustment: string;
  isAvailable: boolean;
  sortOrder: number;
  groupId: string;
  ingredients?: Array<{
    ingredient: Ingredient;
  }>;
}

export interface CartItem {
  drink: Drink;
  quantity: number;
  selectedModifiers: ModifierOption[];
}

export interface Order {
  id: string;
  orderNumber: number;
  status: 'RECEIVED' | 'PREPARING' | 'READY_FOR_PICKUP' | 'COLLECTED';
  diningOption?: 'DINE_IN' | 'TAKEAWAY';
  customerName?: string | null;
  paymentStatus?: 'PENDING' | 'PAID' | 'FAILED';
  total: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  statusHistory?: OrderStatusHistory[];
  trackingToken?: string;
}

/**
 * Public tracking payload — deliberately narrow.
 * Contains no internal ids, prices, payment details, staff names or modifiers.
 */
export interface PublicOrderTracking {
  orderNumber: number;
  status: 'RECEIVED' | 'PREPARING' | 'READY_FOR_PICKUP' | 'COLLECTED';
  statusLabel: string;
  statusMessage: string;
  diningOption: 'DINE_IN' | 'TAKEAWAY';
  customerName: string | null;
  items: Array<{ name: string; quantity: number }>;
  createdAt: string;
  updatedAt: string;
}

/** Read-only payment state polled by the return page. */
export interface PaymentStatusResponse {
  orderId: string;
  orderNumber: number;
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED';
  paid: boolean;
  trackingToken: string | null;
}

/** Full PayHere form payload built server-side. */
export interface PayHereInitResponse {
  action: string;
  method: 'POST';
  mode: 'sandbox' | 'live';
  fields: Record<string, string>;
}

export interface OrderItem {
  id: string;
  drinkName: string;
  drinkPrice: string;
  quantity: number;
  modifiers: OrderItemModifier[];
}

export interface OrderItemModifier {
  id: string;
  optionName: string;
  priceAdjustment: string;
}

export interface OrderStatusHistory {
  id: string;
  status: string;
  changedAt: string;
}

export interface User {
  id: string;
  email: string;
  role: 'ADMIN' | 'BARISTA';
}
