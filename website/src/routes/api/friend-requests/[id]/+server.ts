import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { friendRequest } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

// Sender-only cancel of a pending outgoing request. Deletes the row (not CANCELLED)
// for the same reason decline deletes it - see schema.ts comment on friendRequest.
export const DELETE: RequestHandler = async ({ request, params }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const userId = Number(session.user.id);
	const requestId = Number(params.id);
	if (!Number.isFinite(requestId)) throw error(400, 'Invalid request id');

	const [existing] = await db
		.select({ id: friendRequest.id, senderId: friendRequest.senderId, status: friendRequest.status })
		.from(friendRequest)
		.where(eq(friendRequest.id, requestId))
		.limit(1);

	if (!existing) throw error(404, 'Friend request not found');
	if (existing.senderId !== userId) throw error(403, 'Not your friend request to cancel');
	if (existing.status !== 'PENDING') throw error(400, 'Friend request is no longer pending');

	await db.delete(friendRequest).where(eq(friendRequest.id, requestId));

	return json({ success: true });
};
