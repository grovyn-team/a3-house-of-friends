// Legacy types for backward compatibility
export type ServiceType = 'playstation' | 'snooker' | 'racing' | 'general';

export interface Service {
  id: ServiceType;
  name: string;
  icon: string;
  rate: number;
  description?: string;
}

export interface QueueEntry {
  id: string;
  name: string;
  phone: string;
  service: ServiceType;
  joinedAt: Date;
  status: 'waiting' | 'next' | 'serving';
  position: number;
}

export interface Station {
  id: string;
  name: string;
  type: ServiceType;
  status: 'available' | 'occupied';
  currentCustomer?: {
    name: string;
    phone: string;
    startTime: Date;
  };
  rate: number;
}

export interface DashboardStats {
  activeNow: number;
  todayRevenue: number;
  servedToday: number;
  inQueue: number;
  avgWaitTime: number;
}

export const SERVICES: Service[] = [
  { id: 'racing', name: 'Sand Racing', icon: '🏎️', rate: 250, description: 'Racing simulator experience' },
  { id: 'playstation', name: 'PlayStation', icon: '🎮', rate: 150, description: 'PS5 gaming stations' },
  { id: 'snooker', name: 'Snooker', icon: '🎱', rate: 120, description: 'Professional snooker table' },
  { id: 'general', name: 'Cafe Only', icon: '☕', rate: 0, description: 'Just here for food & drinks' },
];

export const getServiceById = (id: ServiceType): Service => {
  return SERVICES.find(s => s.id === id) || SERVICES[3];
};

// New activity-based types
export type ActivityType = 'snooker-standard' | 'snooker-premium' | 'playstation' | 'racing';
export type PricingType = 'per-minute' | 'per-hour' | 'fixed-duration';
export type MenuCategory = 'chinese' | 'sandwiches' | 'pasta' | 'beverages';
export type SessionStatus = 'pending' | 'active' | 'paused' | 'completed' | 'ended' | 'cancelled';
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';

export interface QRContext {
  branchId?: string;
  zoneId?: string;
  tableId?: string;
}

export interface ActivityUnit {
  id: string;
  name: string;
  activityId: string;
  status: 'available' | 'occupied' | 'maintenance';
}

export interface Activity {
  id: ActivityType;
  name: string;
  description: string;
  pricingType: PricingType;
  baseRate: number;
  minimumDuration: number; // in minutes
  duration?: number; // for fixed-duration activities
  units: ActivityUnit[];
  enabled: boolean;
  bufferTime: number; // in minutes
  peakMultiplier?: number;
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  category: MenuCategory;
  price: number;
  available: boolean;
}

export interface PauseEntry {
  startTime: Date;
  endTime?: Date;
  duration?: number; // in minutes
  reason?: string;
  pausedBy?: 'customer' | 'admin';
}

export interface ChallengePlayer {
  name: string;
  phone?: string;
  isWinner?: boolean;
  hasVoted?: boolean;
  voteFor?: string;
}

export interface ChallengeSession {
  sessionType: 'challenge';
  players: ChallengePlayer[];
  winner?: string;
  winnerSelectedBy?: 'players' | 'admin';
  winnerSelectedAt?: Date;
  totalPlayers: number;
  challengeStartedBy: string;
  challengeStartedByPhone: string;
}

export interface Session {
  id: string;
  activityId: ActivityType;
  unitId: string;
  customerName: string;
  customerPhone: string;
  startTime: Date;
  endTime: Date;
  duration: number; // in minutes
  status: SessionStatus;
  totalAmount: number;
  amount?: number;
  finalAmount?: number;
  paymentStatus: PaymentStatus;
  qrContext?: QRContext;
  pauseHistory?: PauseEntry[];
  totalPausedDuration?: number;
  currentPauseStart?: Date;
  // Challenge/Friends session
  isChallengeSession?: boolean;
  challengeData?: ChallengeSession;
}

export interface Order {
  id: string;
  items: OrderItem[];
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  createdAt: Date;
  qrContext?: QRContext;
  sessionId?: string;
}

export interface OrderItem {
  menuItemId: string;
  quantity: number;
  price: number;
  notes?: string;
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes?: string;
}

export interface BookingRequest {
  activityId: ActivityType;
  unitId: string;
  duration: number;
  customerName: string;
  customerPhone: string;
  qrContext?: QRContext;
}

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatDuration = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours} hr`;
  }
  return `${hours} hr ${mins} min`;
};
