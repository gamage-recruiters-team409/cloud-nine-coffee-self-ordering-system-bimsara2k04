import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  emitOrderCreated(order: any) {
    this.server.emit('order.created', order);
  }

  emitOrderStatusChanged(order: any) {
    this.server.emit('order.statusChanged', order);
  }

  emitIngredientAvailabilityChanged(ingredient: any) {
    this.server.emit('ingredient.availabilityChanged', ingredient);
  }

  emitMenuAvailabilityChanged() {
    this.server.emit('menu.availabilityChanged');
  }
}
