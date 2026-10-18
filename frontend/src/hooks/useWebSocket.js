import { useEffect, useState, useCallback } from 'react';
import WebSocketClient from '@/services/websocket.client';

export function useWebSocket(url) {
  const [client, setClient] = useState(null);
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('connecting');

  useEffect(() => {
    const ws = new WebSocketClient(url);
    ws.on('open', () => setStatus('connected'));
    ws.on('close', () => setStatus('disconnected'));
    ws.on('message', (data) => setMessages((prev) => [...prev, data]));
    ws.on('error', () => setStatus('error'));
    ws.connect();
    setClient(ws);
    return () => ws.disconnect();
  }, [url]);

  const send = useCallback((data) => client?.send(data), [client]);

  return { client, messages, status, send };
}
