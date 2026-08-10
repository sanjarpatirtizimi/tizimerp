export type UserRole = "SUPER_ADMIN" | "OPERATOR";
export type DriverStatus = "ACTIVE" | "BLOCKED" | "PENDING";
export type DeviceStatus = "ONLINE" | "OFFLINE" | "MAINTENANCE" | "ERROR";
export type SyncStatus = "PENDING" | "SYNCED" | "FAILED";
export type TransactionType =
  | "STAMP"
  | "CASH_ADVANCE"
  | "GOODS_EXCHANGE"
  | "MANUAL_ADJUSTMENT";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface StaffUser {
  id: string;
  fullName: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Device {
  id: string;
  name: string;
  ipAddress: string | null;
  port: number;
  username: string | null;
  location: string | null;
  status: DeviceStatus;
  lastPingAt: string | null;
  /** True if a local relay agent API key has been issued for this device. */
  hasAgent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DriverDeviceRegistration {
  id: string;
  driverId: string;
  deviceId: string;
  device: Device;
  hikvisionFaceId: string | null;
  syncStatus: SyncStatus;
  syncError: string | null;
  syncedAt: string | null;
  pairingExpiresAt: string | null;
  createdAt: string;
}

export type RecognitionEventStatus =
  | "PROCESSED"
  | "IGNORED_COOLDOWN"
  | "UNMATCHED"
  | "ERROR";

export type FeedbackStatus = "OPEN" | "READ" | "RESOLVED";

export interface Driver {
  id: string;
  fullName: string;
  phone: string;
  carPlate: string | null;
  carBrand: string | null;
  carModel: string | null;
  photoUrl: string | null;
  status: DriverStatus;
  telegramUsername?: string | null;
  createdAt: string;
  updatedAt: string;
  deviceRegistrations?: DriverDeviceRegistration[];
}

export interface VisitEvent {
  id: string;
  deviceId: string;
  driverId: string | null;
  employeeNoRaw: string | null;
  eventDateTime: string | null;
  status: RecognitionEventStatus;
  isRedFlagged: boolean;
  flaggedAt: string | null;
  flagNote: string | null;
  createdAt: string;
  driver: {
    id: string;
    fullName: string;
    phone: string;
    carPlate: string | null;
    photoUrl: string | null;
    status: DriverStatus;
    telegramUsername: string | null;
  } | null;
  device: { id: string; name: string };
  flaggedBy: { id: string; fullName: string } | null;
  transaction: { id: string; amount: string; type: string } | null;
}

export interface DriverFeedback {
  id: string;
  driverId: string;
  body: string;
  status: FeedbackStatus;
  staffNote: string | null;
  createdAt: string;
  updatedAt: string;
  driver: {
    id: string;
    fullName: string;
    phone: string;
    carPlate?: string | null;
    telegramUsername: string | null;
  };
}

export interface Product {
  id: string;
  name: string;
  category: string | null;
  unitPrice: string;
  stockQty: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  driverId: string;
  type: TransactionType;
  amount: string;
  description: string | null;
  operatorId: string | null;
  operator: { id: string; fullName: string } | null;
  deviceId: string | null;
  device: { id: string; name: string } | null;
  productId: string | null;
  product: { id: string; name: string } | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface DriverBalanceSummary {
  driverId: string;
  balance: string;
  totalStampPoints: string;
  totalCashAdvances: string;
  totalGoodsExchanged: string;
}

export interface PaginatedTransactions {
  items: Transaction[];
  total: number;
  page: number;
  pageSize: number;
}
