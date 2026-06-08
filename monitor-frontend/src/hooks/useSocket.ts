import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import type { PingRecord } from '../types';

type Status = 'connecting' | 'connected' | 'disconnected';

export function useSocket(
  onPing: (record: PingRecord) => void,
  onAnomaly?: (record: PingRecord) => void,
) {
  const [status, setStatus] = useState<Status>('connecting');

  const onPingRef = useRef(onPing);
  onPingRef.current = onPing;
  const onAnomalyRef = useRef(onAnomaly);
  onAnomalyRef.current = onAnomaly;

  useEffect(() => {
    const socket = io({ transports: ['websocket', 'polling'] });

    socket.on('connect', () => setStatus('connected'));
    socket.on('disconnect', () => setStatus('disconnected'));
    socket.on('connect_error', () => setStatus('disconnected'));
    socket.on('new_ping', (record: PingRecord) => onPingRef.current(record));
    socket.on('anomaly_detected', (record: PingRecord) => onAnomalyRef.current?.(record));

    return () => { socket.disconnect(); };
  }, []);

  return status;
}
