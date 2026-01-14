import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Namespace } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { getRedis } from '../config/redis.js';
import jwt from 'jsonwebtoken';

let io: SocketIOServer | null = null;

export const initializeWebSocket = (server: HTTPServer): SocketIOServer => {
  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  const pubClient = getRedis().duplicate();
  const subClient = getRedis().duplicate();
  io.adapter(createAdapter(pubClient, subClient));

  const customerNS = io.of('/customer');
  setupCustomerNamespace(customerNS);

  const adminNS = io.of('/admin');
  setupAdminNamespace(adminNS);

  const staffNS = io.of('/staff');
  setupStaffNamespace(staffNS);

  console.log('✅ WebSocket server initialized');
  return io;
};

const customerSocketMap = new Map<string, Set<string>>();

function setupCustomerNamespace(namespace: Namespace) {
  namespace.use(async (socket, next) => {
    const { token } = socket.handshake.auth;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
        socket.data.qrContext = decoded;
      } catch (error) {
      }
    }
    next();
  });

  namespace.on('connection', (socket) => {
    console.log('Customer connected:', socket.id);

    if (io) {
      io.of('/admin').emit('visitor_connected', {
        socketId: socket.id,
        timestamp: new Date().toISOString(),
      });
    }

    socket.on('register_customer', ({ phone }) => {
      if (phone) {
        const normalizedPhone = phone.replace(/\D/g, '');
        if (!customerSocketMap.has(normalizedPhone)) {
          customerSocketMap.set(normalizedPhone, new Set());
        }
        customerSocketMap.get(normalizedPhone)!.add(socket.id);
        socket.data.customerPhone = normalizedPhone;
        console.log(`Customer ${socket.id} registered with phone: ${normalizedPhone}`);
      }
    });

    socket.on('join_activity', ({ activity_id }) => {
      socket.join(`activity:${activity_id}`);
      if (process.env.NODE_ENV === 'development') {
        console.log(`Customer ${socket.id} joined activity:${activity_id}`);
      }
    });

    socket.on('join_session', ({ session_id }) => {
      socket.join(`session:${session_id}`);
      console.log(`Customer ${socket.id} joined session:${session_id}`);
    });

    socket.on('join_order', ({ order_id }) => {
      socket.join(`order:${order_id}`);
      console.log(`Customer ${socket.id} joined order:${order_id}`);
    });

    socket.on('join_reservation', ({ reservation_id }) => {
      socket.join(`reservation:${reservation_id}`);
      console.log(`Customer ${socket.id} joined reservation:${reservation_id}`);
    });

    socket.on('visitor_connected', (data) => {
      if (io) {
        io.of('/admin').emit('visitor_connected', {
          ...data,
          socketId: socket.id,
        });
      }
    });

    socket.on('booking_created', (data) => {
      if (io) {
        io.of('/admin').emit('booking_created', {
          ...data,
          socketId: socket.id,
        });
      }
    });

    socket.on('order_created', (data) => {
      if (io) {
        io.of('/admin').emit('order_created', {
          ...data,
          socketId: socket.id,
        });
      }
    });

    socket.on('payment_completed', (data) => {
      if (io) {
        io.of('/admin').emit('payment_completed', {
          ...data,
          socketId: socket.id,
        });
      }
    });

    socket.on('ping', ({ session_id, timestamp }) => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    socket.on('disconnect', () => {
      console.log('Customer disconnected:', socket.id);
      
      if (socket.data.customerPhone) {
        const phoneSet = customerSocketMap.get(socket.data.customerPhone);
        if (phoneSet) {
          phoneSet.delete(socket.id);
          if (phoneSet.size === 0) {
            customerSocketMap.delete(socket.data.customerPhone);
          }
        }
      }
      
      if (io) {
        io.of('/admin').emit('visitor_disconnected', {
          socketId: socket.id,
          timestamp: new Date().toISOString(),
        });
      }
    });
  });
}

export function notifyCustomerByPhone(phone: string, event: string, data: any) {
  if (!io) return;
  
  const normalizedPhone = phone.replace(/\D/g, ''); // Remove non-digits
  const socketIds = customerSocketMap.get(normalizedPhone);
  
  if (socketIds && socketIds.size > 0) {
    socketIds.forEach(socketId => {
      io!.of('/customer').to(socketId).emit(event, data);
    });
    console.log(`Notified customer ${normalizedPhone} (${socketIds.size} socket(s)): ${event}`);
  } else {
    console.log(`No active sockets found for customer phone: ${normalizedPhone}`);
  }
}

export function notifyCustomerById(id: string, type: 'reservation' | 'order' | 'session', event: string, data: any) {
  if (!io) return;
  
  const room = type === 'reservation' ? `reservation:${id}` :
               type === 'order' ? `order:${id}` :
               `session:${id}`;
  
  io.of('/customer').to(room).emit(event, data);
  console.log(`Notified customer in room ${room}: ${event}`);
}

function setupAdminNamespace(namespace: Namespace) {
  namespace.use(async (socket, next) => {
    const { authToken } = socket.handshake.auth;
    
    if (!authToken) {
      return next(new Error('Unauthorized'));
    }

    try {
      const decoded = jwt.verify(authToken, process.env.JWT_SECRET || 'secret') as any;
      socket.data.admin = decoded;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  namespace.on('connection', (socket) => {
    console.log('Admin connected:', socket.id, socket.data.admin?.username);

    if (socket.data.admin?.branchId) {
      socket.join(`branch:${socket.data.admin.branchId}`);
    } else {
      socket.join('branch:all');
    }

    socket.on('force_end_session', async ({ session_id, reason }) => {
      try {
        const { endSession } = await import('../controllers/sessionController.js');
        socket.emit('command_success', { action: 'force_end_session', session_id });
      } catch (error: any) {
        socket.emit('command_error', { action: 'force_end_session', error: error.message });
      }
    });

    socket.on('disconnect', () => {
      console.log('Admin disconnected:', socket.id);
    });
  });
}

function setupStaffNamespace(namespace: Namespace) {
  namespace.use(async (socket, next) => {
    const { authToken } = socket.handshake.auth;
    
    if (!authToken) {
      return next(new Error('Unauthorized'));
    }

    try {
      const decoded = jwt.verify(authToken, process.env.JWT_SECRET || 'secret') as any;
      socket.data.staff = decoded;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  namespace.on('connection', (socket) => {
    console.log('Staff connected:', socket.id);

    if (socket.data.staff?.branchId) {
      socket.join(`branch:${socket.data.staff.branchId}`);
    }

    socket.on('disconnect', () => {
      console.log('Staff disconnected:', socket.id);
    });
  });
}

export function broadcastAvailabilityChange(activityId: string, status: string) {
  if (!io) return;
  io.of('/customer').to(`activity:${activityId}`).emit('availability_changed', {
    activity_id: activityId,
    status,
    timestamp: Date.now(),
  });
}

export function broadcastTimerUpdate(sessionId: string, elapsed: number, remaining: number) {
  if (!io) return;
  
  const data = {
    session_id: sessionId,
    elapsed_seconds: elapsed,
    remaining_seconds: remaining,
    timestamp: Date.now(),
  };

  io.of('/customer').to(`session:${sessionId}`).emit('timer_update', data);
  
  io.of('/admin').emit('timer_update', data);
}

export function broadcastSessionEvent(event: string, data: any) {
  if (!io) return;
  
  io.of('/customer').emit(event, data);
  io.of('/admin').emit(event, data);
}

export function broadcastFoodOrder(order: any) {
  if (!io) return;
  
  const branchId = order.qrContext?.branchId || 'all';
  
  io.of('/staff').to(`branch:${branchId}`).emit('food_order_received', order);
  
  io.of('/admin').to(`branch:${branchId}`).emit('food_order_received', order);
}

export function broadcastQueueUpdate() {
  if (!io) return;
  io.of('/admin').emit('queue_updated', {
    timestamp: new Date().toISOString(),
  });
}

export function getIO(): SocketIOServer | null {
  return io;
}

