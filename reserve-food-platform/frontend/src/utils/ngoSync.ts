const NGO_SYNC_EVENT = 'reserve:ngo-sync';
const NGO_SYNC_STORAGE_KEY = 'reserve:ngo-sync';

export type NgoSyncReason =
  | 'claim-created'
  | 'claim-collected'
  | 'profile-updated'
  | 'verification-submitted'
  | 'manual-refresh';

interface NgoSyncDetail {
  reason: NgoSyncReason;
  timestamp: number;
}

export function emitNgoSync(reason: NgoSyncReason): void {
  if (typeof window === 'undefined') return;

  const detail: NgoSyncDetail = {
    reason,
    timestamp: Date.now(),
  };

  window.dispatchEvent(new CustomEvent<NgoSyncDetail>(NGO_SYNC_EVENT, { detail }));

  try {
    localStorage.setItem(NGO_SYNC_STORAGE_KEY, JSON.stringify(detail));
  } catch {
    // Ignore storage failures (private mode/quota) and keep in-tab event working.
  }
}

export function subscribeNgoSync(handler: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {
      // noop on non-browser runtimes
    };
  }

  const onSyncEvent = () => handler();
  const onStorage = (event: StorageEvent) => {
    if (event.key === NGO_SYNC_STORAGE_KEY && event.newValue) {
      handler();
    }
  };

  window.addEventListener(NGO_SYNC_EVENT, onSyncEvent);
  window.addEventListener('storage', onStorage);

  return () => {
    window.removeEventListener(NGO_SYNC_EVENT, onSyncEvent);
    window.removeEventListener('storage', onStorage);
  };
}
