import { useCallback, useMemo, useState, type ReactNode } from 'react';

import { useFightHub } from '@/hooks/useFightHub';

import { FightHubContext, type FightHubContextValue } from './fightHubState';

/**
 * FightHubProvider — conexión única al canal público de combates.
 *
 * Cada consumidor registra sus grupos con un `ownerId` estable. El provider
 * une los registros, abre una sola conexión y la mantiene solo mientras haya
 * algo que observar. Así la cartelera y el boleto comparten el mismo estado
 * aunque el usuario navegue a otra disciplina.
 */

type Registry = Readonly<Record<string, readonly string[]>>;

const EMPTY_IDS: readonly string[] = [];

function normalizeIds(ids: readonly string[]): readonly string[] {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  return unique.length === 0 ? EMPTY_IDS : unique;
}

function setRegistration(
  previous: Registry,
  ownerId: string,
  ids: readonly string[],
): Registry {
  const next = normalizeIds(ids);
  const current = previous[ownerId];

  if (
    current &&
    current.length === next.length &&
    current.every((id, index) => id === next[index])
  ) {
    return previous;
  }

  if (next.length === 0) {
    if (!current) return previous;

    const copy = { ...previous };
    delete copy[ownerId];
    return copy;
  }

  return { ...previous, [ownerId]: next };
}

function removeRegistration(previous: Registry, ownerId: string): Registry {
  if (!previous[ownerId]) return previous;

  const copy = { ...previous };
  delete copy[ownerId];
  return copy;
}

function unionIds(registry: Registry): readonly string[] {
  const unique = new Set<string>();

  for (const ids of Object.values(registry)) {
    for (const id of ids) unique.add(id);
  }

  return unique.size === 0 ? EMPTY_IDS : [...unique];
}

export function FightHubProvider({ children }: { children: ReactNode }) {
  const [eventRegistry, setEventRegistry] = useState<Registry>({});
  const [cardRegistry, setCardRegistry] = useState<Registry>({});

  const watchEvents = useCallback((ownerId: string, eventIds: readonly string[]) => {
    const owner = ownerId.trim();
    if (!owner) return;

    setEventRegistry((previous) => setRegistration(previous, owner, eventIds));
  }, []);

  const unwatchEvents = useCallback((ownerId: string) => {
    const owner = ownerId.trim();
    if (!owner) return;

    setEventRegistry((previous) => removeRegistration(previous, owner));
  }, []);

  const watchCards = useCallback((ownerId: string, cardKeys: readonly string[]) => {
    const owner = ownerId.trim();
    if (!owner) return;

    setCardRegistry((previous) => setRegistration(previous, owner, cardKeys));
  }, []);

  const unwatchCards = useCallback((ownerId: string) => {
    const owner = ownerId.trim();
    if (!owner) return;

    setCardRegistry((previous) => removeRegistration(previous, owner));
  }, []);

  const watchedEventIds = useMemo(() => unionIds(eventRegistry), [eventRegistry]);
  const watchedCardKeys = useMemo(() => unionIds(cardRegistry), [cardRegistry]);

  const {
    status,
    isConnected,
    updates,
    clocks,
    cardUpdates,
    lastUpdateAt,
    reconnectCount,
  } = useFightHub({
    eventIds: watchedEventIds,
    cardKeys: watchedCardKeys,
    enabled: watchedEventIds.length > 0 || watchedCardKeys.length > 0,
  });

  const value = useMemo<FightHubContextValue>(
    () => ({
      status,
      isConnected,
      updates,
      clocks,
      cardUpdates,
      lastUpdateAt,
      reconnectCount,
      watchEvents,
      unwatchEvents,
      watchCards,
      unwatchCards,
    }),
    [
      status,
      isConnected,
      updates,
      clocks,
      cardUpdates,
      lastUpdateAt,
      reconnectCount,
      watchEvents,
      unwatchEvents,
      watchCards,
      unwatchCards,
    ],
  );

  return <FightHubContext.Provider value={value}>{children}</FightHubContext.Provider>;
}

export default FightHubProvider;
