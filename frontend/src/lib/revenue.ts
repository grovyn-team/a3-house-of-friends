export interface RevenueBreakdownItem {
  label: string;
  amount: number;
}

function isToday(date: Date | string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  return checkDate.getTime() === today.getTime();
}

export function calculateFoodRevenue(orders: any[], todayOnly = false): number {
  return orders.reduce((sum: number, order: any) => {
    if (order.paymentStatus === 'paid' || order.paymentStatus === 'offline') {
      if (todayOnly && order.createdAt && !isToday(order.createdAt)) {
        return sum;
      }
      return sum + (order.totalAmount || 0);
    }
    return sum;
  }, 0);
}

export function calculateSessionRevenue(sessions: any[], todayOnly = false): number {
  return sessions.reduce((sum: number, session: any) => {
    if (todayOnly && session.createdAt && !isToday(session.createdAt)) {
      return sum;
    }
    return sum + (session.totalAmount || 0);
  }, 0);
}

export function calculateRevenueBreakdown(sessions: any[], orders: any[], todayOnly = false): RevenueBreakdownItem[] {
  const breakdown: RevenueBreakdownItem[] = [];
  
  sessions.forEach((session: any) => {
    if (todayOnly && session.createdAt && !isToday(session.createdAt)) {
      return;
    }
    
    const activityName = session.activityId
      .replace('-', ' ')
      .replace(/\b\w/g, (letter: string) => letter.toUpperCase());
    
    const existing = breakdown.find(item => item.label === activityName);
    if (existing) {
      existing.amount += session.totalAmount || 0;
    } else {
      breakdown.push({ label: activityName, amount: session.totalAmount || 0 });
    }
  });
  
  const foodRevenue = calculateFoodRevenue(orders, todayOnly);
  if (foodRevenue > 0) {
    const existing = breakdown.find(item => item.label === 'Food & Beverages');
    if (existing) {
      existing.amount += foodRevenue;
    } else {
      breakdown.push({ label: 'Food & Beverages', amount: foodRevenue });
    }
  }
  
  return breakdown;
}

export function calculateTotalRevenue(sessions: any[], orders: any[], todayOnly = false): number {
  const sessionRevenue = calculateSessionRevenue(sessions, todayOnly);
  const foodRevenue = calculateFoodRevenue(orders, todayOnly);
  return sessionRevenue + foodRevenue;
}
