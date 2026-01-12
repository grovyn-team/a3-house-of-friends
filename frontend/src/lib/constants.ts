import { Activity, MenuItem, ActivityType, MenuCategory } from './types';

// Activities Configuration
export const ACTIVITIES: Activity[] = [
  {
    id: 'snooker-standard',
    name: 'Snooker Table (Standard)',
    description: 'Professional snooker table',
    pricingType: 'per-minute',
    baseRate: 5,
    minimumDuration: 30,
    units: [
      { id: 'snooker-1', name: 'Table 1', activityId: 'snooker-standard', status: 'available' },
      { id: 'snooker-2', name: 'Table 2', activityId: 'snooker-standard', status: 'available' },
    ],
    enabled: true,
    bufferTime: 5,
  },
  {
    id: 'snooker-premium',
    name: 'Snooker Table (Premium)',
    description: 'Premium snooker table with enhanced features',
    pricingType: 'per-minute',
    baseRate: 6,
    minimumDuration: 30,
    units: [
      { id: 'snooker-premium-1', name: 'Premium Table 1', activityId: 'snooker-premium', status: 'available' },
    ],
    enabled: true,
    bufferTime: 5,
  },
  {
    id: 'playstation',
    name: 'PlayStation',
    description: 'PS5 gaming stations',
    pricingType: 'per-hour',
    baseRate: 120,
    minimumDuration: 30,
    units: [
      { id: 'ps-1', name: 'PS-1', activityId: 'playstation', status: 'available' },
      { id: 'ps-2', name: 'PS-2', activityId: 'playstation', status: 'available' },
      { id: 'ps-3', name: 'PS-3', activityId: 'playstation', status: 'available' },
    ],
    enabled: true,
    bufferTime: 10,
  },
  {
    id: 'racing',
    name: 'Sand Crane Racing Track',
    description: 'Racing simulator experience',
    pricingType: 'fixed-duration',
    baseRate: 120,
    duration: 20,
    minimumDuration: 20,
    units: [
      { id: 'racing-1', name: 'Racing Track 1', activityId: 'racing', status: 'available' },
    ],
    enabled: true,
    bufferTime: 5,
  },
];

// Menu Items
export const MENU_ITEMS: MenuItem[] = [
  // Sandwiches
  { id: 'veg-sandwich', name: 'Veg Sandwich', category: 'sandwiches', price: 80, available: true },
  { id: 'cheese-sandwich', name: 'Cheese Sandwich', category: 'sandwiches', price: 100, available: true },
  
  // Chinese
  { id: 'veg-chowmein', name: 'Veg Chowmein', category: 'chinese', price: 120, available: true },
  
  // Pasta
  { id: 'white-sauce-pasta', name: 'White Sauce Pasta', category: 'pasta', price: 150, available: true },
  
  // Beverages
  { id: 'cold-coffee', name: 'Cold Coffee', category: 'beverages', price: 90, available: true },
];

// Category Labels
export const CATEGORY_LABELS: Record<MenuCategory, string> = {
  chinese: 'Chinese',
  sandwiches: 'Sandwiches',
  pasta: 'Pasta',
  beverages: 'Beverages',
};

export const getActivityById = (id: ActivityType): Activity | undefined => {
  return ACTIVITIES.find(a => a.id === id);
};

export const getMenuItemsByCategory = (category: MenuCategory): MenuItem[] => {
  return MENU_ITEMS.filter(item => item.category === category && item.available);
};

export const calculateActivityPrice = (
  activity: Activity,
  duration: number,
  isPeakHour: boolean = false
): number => {
  let basePrice = 0;
  
  if (activity.pricingType === 'per-minute') {
    basePrice = activity.baseRate * duration;
  } else if (activity.pricingType === 'per-hour') {
    const hours = duration / 60;
    basePrice = activity.baseRate * hours;
  } else if (activity.pricingType === 'fixed-duration') {
    const sessions = Math.ceil(duration / (activity.duration || 20));
    basePrice = activity.baseRate * sessions;
  }
  
  if (isPeakHour && activity.peakMultiplier) {
    basePrice = basePrice * activity.peakMultiplier;
  }
  
  return Math.round(basePrice);
};

export const isPeakHour = (date: Date = new Date()): boolean => {
  // Default peak hours: 6 PM - 10 PM on weekends (Fri, Sat, Sun)
  const hour = date.getHours();
  const day = date.getDay();
  const isWeekend = day === 5 || day === 6 || day === 0; // Fri, Sat, Sun
  
  if (isWeekend) {
    return hour >= 18 && hour < 22;
  }
  
  return false;
};

