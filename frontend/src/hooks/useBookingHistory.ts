import { useState, useEffect } from 'react';

export interface BookingHistoryItem {
  id: string;
  type: 'session' | 'order' | 'reservation';
  activityName?: string;
  customerName: string;
  customerPhone: string;
  amount: number;
  status: string;
  createdAt: string;
  sessionId?: string;
  orderId?: string;
  reservationId?: string;
  activityId?: string;
  durationMinutes?: number;
}

const STORAGE_KEY = 'a3houseoffriends_booking_history';

export function useBookingHistory() {
  const [history, setHistory] = useState<BookingHistoryItem[]>([]);

  useEffect(() => {
    // Load from localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch (e) {
        console.error('Error loading booking history:', e);
      }
    }
  }, []);

  const addBooking = (booking: BookingHistoryItem) => {
    const updated = [booking, ...history.filter(h => h.id !== booking.id)];
    setHistory(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const updateBooking = (id: string, updates: Partial<BookingHistoryItem>) => {
    const updated = history.map(item =>
      item.id === id ? { ...item, ...updates } : item
    );
    setHistory(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const getBooking = (id: string): BookingHistoryItem | undefined => {
    return history.find(item => item.id === id);
  };

  const removeBooking = (id: string) => {
    const updated = history.filter(item => item.id !== id);
    setHistory(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return {
    history,
    addBooking,
    updateBooking,
    getBooking,
    removeBooking,
    clearHistory,
  };
}

