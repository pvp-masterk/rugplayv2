import { writable } from 'svelte/store';

export const PENDING_REQUEST_COUNT = writable<number>(0);

export async function fetchPendingRequestCount() {
    try {
        const response = await fetch('/api/friend-requests');
        if (!response.ok) throw new Error('Failed to fetch friend requests');

        const data = await response.json();

        PENDING_REQUEST_COUNT.set(data.pendingRequestCount ?? data.incoming?.length ?? 0);

        return data;
    } catch (error) {
        console.error('Failed to fetch pending friend request count:', error);
        throw error;
    }
}
