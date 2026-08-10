export type UserRole = 'GENERAL_MANAGER' | 'WAREHOUSE_MANAGER';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  gmail: string;
  createdAt: string;
  avatar?: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  unit: string;
  description?: string;
  imageUrl?: string;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT'; // توريد / صرف / تعديل جرد
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  referenceNo?: string;
  operatorName: string;
  timestamp: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  username: string;
  role: UserRole | string;
  action: string;
  details: string;
  type: 'INFO' | 'WARNING' | 'SECURITY' | 'MOVEMENT';
}

export interface RateLimiterState {
  currentMinuteTimestamp: number;
  requestsInCurrentMinute: number;
  secondsRemaining: number;
  currentModel: string;
}

export interface SystemSettings {
  googleSheetUrl: string;
  rateLimitThreshold: number;
  appName: string;
  companyAddress: string;
  companyPhone: string;
}
