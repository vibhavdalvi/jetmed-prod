import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { IJwtPayload, UserRole } from '../types/index.js';

interface AuthenticatedSocket extends Socket {
  user?: IJwtPayload;
}

const connectedUsers = new Map<string, string[]>();

export const getConnectedUsers = () => connectedUsers;
export const getUserSockets = (userId: string): string[] => connectedUsers.get(userId) || [];
export const isUserOnline = (userId: string): boolean => connectedUsers.has(userId);

export const setupSocketIO = (io: SocketIOServer) => {
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      socket.user = jwt.verify(token, config.jwt.secret) as IJwtPayload;
      next();
    } catch { next(new Error('Invalid token')); }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.user!.userId;
    const userRole = socket.user!.role;
    
    const userSockets = connectedUsers.get(userId) || [];
    userSockets.push(socket.id);
    connectedUsers.set(userId, userSockets);

    socket.join(`user:${userId}`);
    socket.join(`role:${userRole}`);

    socket.on('order:subscribe', (orderId) => socket.join(`order:${orderId}`));
    socket.on('chat:join', (convId) => socket.join(`conversation:${convId}`));
    
    socket.on('chat:message', (data) => {
      io.to(`conversation:${data.conversationId}`).emit('chat:new_message', {
        senderId: userId, senderRole: userRole, ...data, timestamp: new Date()
      });
    });

    socket.on('disconnect', () => {
      const sockets = connectedUsers.get(userId)?.filter(id => id !== socket.id) || [];
      sockets.length ? connectedUsers.set(userId, sockets) : connectedUsers.delete(userId);
    });
  });
};

export const emitToUser = (io: SocketIOServer, userId: string, event: string, data: any) => 
  io.to(`user:${userId}`).emit(event, data);
export const emitToOrder = (io: SocketIOServer, orderId: string, event: string, data: any) => 
  io.to(`order:${orderId}`).emit(event, data);
export const emitToWarehouse = (io: SocketIOServer, event: string, data: any) =>
  io.to(`role:${UserRole.WAREHOUSE_STAFF}`).emit(event, data);
