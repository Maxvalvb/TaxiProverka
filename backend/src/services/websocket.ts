import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { verifyToken } from '../utils/helpers';
import { WebSocketEvent, RideUpdateEvent, DriverLocationEvent, ChatMessageEvent } from '../types';

export class WebSocketService {
  private io: SocketIOServer;
  private userSockets: Map<string, string> = new Map(); // userId -> socketId

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        methods: ["GET", "POST"]
      }
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use((socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication error'));
        }

        const decoded = verifyToken(token);
        socket.userId = decoded.id;
        socket.userRole = decoded.role;
        next();
      } catch (error) {
        next(new Error('Authentication error'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User ${socket.userId} connected`);
      
      // Store socket connection
      this.userSockets.set(socket.userId, socket.id);

      // Join user to their personal room
      socket.join(`user:${socket.userId}`);

      // Handle ride-specific rooms
      socket.on('join-ride', (rideId: string) => {
        socket.join(`ride:${rideId}`);
        console.log(`User ${socket.userId} joined ride ${rideId}`);
      });

      socket.on('leave-ride', (rideId: string) => {
        socket.leave(`ride:${rideId}`);
        console.log(`User ${socket.userId} left ride ${rideId}`);
      });

      // Handle driver location updates
      socket.on('driver-location-update', (data: { lat: number; lng: number }) => {
        if (socket.userRole === 'DRIVER') {
          this.broadcastDriverLocation(socket.userId, data.lat, data.lng);
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`User ${socket.userId} disconnected`);
        this.userSockets.delete(socket.userId);
      });
    });
  }

  // Send event to specific user
  public sendToUser(userId: string, event: WebSocketEvent) {
    this.io.to(`user:${userId}`).emit(event.type, event.data);
  }

  // Send event to all users in a ride
  public sendToRide(rideId: string, event: WebSocketEvent) {
    this.io.to(`ride:${rideId}`).emit(event.type, event.data);
  }

  // Broadcast ride update
  public broadcastRideUpdate(rideId: string, ride: any, driver?: any) {
    const event: RideUpdateEvent = {
      type: 'RIDE_UPDATE',
      data: { ride, driver }
    };
    this.sendToRide(rideId, event);
  }

  // Broadcast driver location
  public broadcastDriverLocation(driverId: string, lat: number, lng: number) {
    const event: DriverLocationEvent = {
      type: 'DRIVER_LOCATION',
      data: { driverId, lat, lng }
    };
    
    // Send to all connected clients (for admin dashboard)
    this.io.emit('DRIVER_LOCATION', event.data);
  }

  // Broadcast chat message
  public broadcastChatMessage(rideId: string, message: any) {
    const event: ChatMessageEvent = {
      type: 'CHAT_MESSAGE',
      data: message
    };
    this.sendToRide(rideId, event);
  }

  // Send driver assignment notification
  public notifyDriverAssignment(clientId: string, driverId: string, ride: any) {
    // Notify client
    this.sendToUser(clientId, {
      type: 'DRIVER_ASSIGNED',
      data: { ride, message: 'Водитель найден!' }
    });

    // Notify driver
    this.sendToUser(driverId, {
      type: 'NEW_RIDE_REQUEST',
      data: { ride, message: 'Новый заказ!' }
    });
  }

  // Get connected users count
  public getConnectedUsersCount(): number {
    return this.userSockets.size;
  }
}

// Extend Socket interface to include user info
declare module 'socket.io' {
  interface Socket {
    userId: string;
    userRole: string;
  }
}

export default WebSocketService;