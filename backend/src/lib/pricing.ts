import { Activity } from '../models/Activity.js';

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
  const hour = date.getHours();
  const day = date.getDay();
  const isWeekend = day === 5 || day === 6 || day === 0; // Fri, Sat, Sun

  if (isWeekend) {
    return hour >= 18 && hour < 22;
  }

  return false;
};

