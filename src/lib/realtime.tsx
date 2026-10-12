'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from './auth';
import { useBranches } from './branch';
import { config } from './config';

export interface OrderEvent {
  id: string;
  number: string;
  branchId: string;
  status: string;
  paymentStatus: string;
  updatedAt: string;
  driverId?: string | null;
}
type Handler = (event: string, payload: unknown) => void;

interface RealtimeValue {
  connected: boolean;
  /** Orders created since the dashboard opened that nobody has opened yet. */
  unseen: string[];
  markSeen: (orderId: string) => void;
  subscribe: (h: Handler) => () => void;
  sound: boolean;
  setSound: (on: boolean) => void;
}

const RealtimeContext = createContext<RealtimeValue | null>(null);

/** Short two-tone chime with WebAudio (no audio files, works offline). */
function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.3);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.18);
      o.stop(ctx.currentTime + i * 0.18 + 0.32);
    });
    setTimeout(() => void ctx.close(), 1000);
  } catch {
    /* audio unavailable */
  }
}

/**
 * One Socket.IO connection for the dashboard. Auth uses the httpOnly access cookie sent in the handshake; the server
 * only lets the user join rooms of branches they can access. Pages always resync over REST, so a missed event never
 * loses data.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { me, can } = useAuth();
  const { branches } = useBranches();
  const [connected, setConnected] = useState(false);
  const [unseen, setUnseen] = useState<string[]>([]);
  const [sound, setSoundState] = useState(true);
  const handlers = useRef(new Set<Handler>());
  const soundRef = useRef(sound);
  const branchKey = branches.map((b) => b.id).join(',');
  const canRead = can('orders:read');

  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  useEffect(() => {
    if (!me || !canRead || !branchKey) return;
    const socket: Socket = io(config.apiUrl, { withCredentials: true, transports: ['websocket', 'polling'] });
    const join = () => branchKey.split(',').forEach((id) => socket.emit('join_branch', id));
    socket.on('connect', () => {
      setConnected(true);
      join();
    });
    socket.on('disconnect', () => setConnected(false));
    socket.onAny((event: string, payload: unknown) => {
      if (event === 'order.created') {
        const o = payload as OrderEvent;
        setUnseen((u) => (u.includes(o.id) ? u : [...u, o.id]));
        if (soundRef.current) chime();
      }
      handlers.current.forEach((h) => h(event, payload));
    });
    return () => {
      socket.disconnect();
    };
  }, [me, canRead, branchKey]);

  const value = useMemo<RealtimeValue>(
    () => ({
      connected,
      unseen,
      markSeen: (id) => setUnseen((u) => u.filter((x) => x !== id)),
      subscribe: (h) => {
        handlers.current.add(h);
        return () => handlers.current.delete(h);
      },
      sound,
      setSound: setSoundState,
    }),
    [connected, unseen, sound],
  );
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeValue {
  const v = useContext(RealtimeContext);
  if (!v) throw new Error('useRealtime outside RealtimeProvider');
  return v;
}

/** Re-run `onEvent` for realtime events matching the predicate (e.g. reload a list when an order changes). */
export function useRealtimeEvent(filter: (event: string) => boolean, onEvent: (event: string, payload: unknown) => void) {
  const { subscribe } = useRealtime();
  const cb = useRef(onEvent);
  const f = useRef(filter);
  useEffect(() => {
    cb.current = onEvent;
    f.current = filter;
  });
  useEffect(() => subscribe((e, p) => f.current(e) && cb.current(e, p)), [subscribe]);
}
