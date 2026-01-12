import { QueueEntry, Station, DashboardStats, ServiceType } from './types';

// Mock queue data
export const mockQueue: QueueEntry[] = [
  {
    id: '1',
    name: 'Rajesh Kumar',
    phone: '+91 98765 43210',
    service: 'racing',
    joinedAt: new Date(Date.now() - 22 * 60 * 1000),
    status: 'next',
    position: 1,
  },
  {
    id: '2',
    name: 'Priya Sharma',
    phone: '+91 87654 32109',
    service: 'playstation',
    joinedAt: new Date(Date.now() - 18 * 60 * 1000),
    status: 'waiting',
    position: 2,
  },
  {
    id: '3',
    name: 'Arjun Patel',
    phone: '+91 76543 21098',
    service: 'snooker',
    joinedAt: new Date(Date.now() - 12 * 60 * 1000),
    status: 'waiting',
    position: 3,
  },
  {
    id: '4',
    name: 'Sneha Kapoor',
    phone: '+91 65432 10987',
    service: 'playstation',
    joinedAt: new Date(Date.now() - 8 * 60 * 1000),
    status: 'waiting',
    position: 4,
  },
  {
    id: '5',
    name: 'Amit Singh',
    phone: '+91 54321 09876',
    service: 'racing',
    joinedAt: new Date(Date.now() - 5 * 60 * 1000),
    status: 'waiting',
    position: 5,
  },
];

// Mock stations data
export const mockStations: Station[] = [
  {
    id: 'ps1',
    name: 'PS-1',
    type: 'playstation',
    status: 'occupied',
    currentCustomer: {
      name: 'Rajesh Kumar',
      phone: '+91 98765 43210',
      startTime: new Date(Date.now() - 84 * 60 * 1000),
    },
    rate: 150,
  },
  {
    id: 'ps2',
    name: 'PS-2',
    type: 'playstation',
    status: 'occupied',
    currentCustomer: {
      name: 'Priya Sharma',
      phone: '+91 87654 32109',
      startTime: new Date(Date.now() - 45 * 60 * 1000),
    },
    rate: 150,
  },
  {
    id: 'ps3',
    name: 'PS-3',
    type: 'playstation',
    status: 'available',
    rate: 150,
  },
  {
    id: 'table1',
    name: 'Table-1',
    type: 'snooker',
    status: 'occupied',
    currentCustomer: {
      name: 'Arjun Patel',
      phone: '+91 76543 21098',
      startTime: new Date(Date.now() - 130 * 60 * 1000),
    },
    rate: 120,
  },
  {
    id: 'table2',
    name: 'Table-2',
    type: 'snooker',
    status: 'available',
    rate: 120,
  },
  {
    id: 'racing1',
    name: 'Racing-1',
    type: 'racing',
    status: 'occupied',
    currentCustomer: {
      name: 'Vikram Singh',
      phone: '+91 90123 45678',
      startTime: new Date(Date.now() - 32 * 60 * 1000),
    },
    rate: 250,
  },
];

export const mockStats: DashboardStats = {
  activeNow: 8,
  todayRevenue: 8450,
  servedToday: 24,
  inQueue: 5,
  avgWaitTime: 18,
};

export const getQueueByService = (service: ServiceType | 'all'): QueueEntry[] => {
  if (service === 'all') return mockQueue;
  return mockQueue.filter(q => q.service === service);
};

export const getStationsByType = (type: ServiceType | 'all'): Station[] => {
  if (type === 'all') return mockStations;
  return mockStations.filter(s => s.type === type);
};
