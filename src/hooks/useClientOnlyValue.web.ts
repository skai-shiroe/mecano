import { useSyncExternalStore } from 'react';

// This subscription never changes; React switches snapshots after hydration.
const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function useClientOnlyValue<S, C>(server: S, client: C): S | C {
  const isClient = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  return isClient ? client : server;
}
