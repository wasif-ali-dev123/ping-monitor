import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { PingRecord } from '@prisma/client';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class PingsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(PingsGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  broadcastNewPing(record: PingRecord): void {
    this.server.emit('new_ping', record);
    this.logger.debug(`Broadcast new_ping: ${record.id}`);
  }

  broadcastAnomaly(record: PingRecord): void {
    this.server.emit('anomaly_detected', record);
    this.logger.warn(
      `Broadcast anomaly_detected: ${record.id} (${record.responseTime}ms)`,
    );
  }
}
