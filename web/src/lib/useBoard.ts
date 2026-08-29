import { useCallback, useEffect, useState } from 'react';
import type { BoardDto, StreamEvent } from '@shared/types';
import { api } from './api';

export interface BoardState {
  board: BoardDto | null;
  connected: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/** Keeps the board in sync over SSE and falls back to a fetch if the stream drops. */
export function useBoard(): BoardState {
  const [board, setBoard] = useState<BoardDto | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setBoard(await api.board());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load the board');
    }
  }, []);

  useEffect(() => {
    void refresh();

    const source = new EventSource('/api/stream');
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (event) => {
      const payload = JSON.parse(event.data as string) as StreamEvent;
      if (payload.type === 'board') setBoard(payload.board);
      else void refresh();
    };

    return () => source.close();
  }, [refresh]);

  return { board, connected, error, refresh };
}
