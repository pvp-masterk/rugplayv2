import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { friendRequest, userFriend, user } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { createNotification } from '$lib/server/notification';
import { checkAndAwardAchievements } from '$lib/server/achievements';
import { getFriendCount } from '$lib/server/friends';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, params }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const userId = Number(session.user.id);
	const requestId = Number(params.id);
	if (!Number.isFinite(requestId)) throw error(400, 'Invalid request id');

	const [existing] = await db
		.select({
			id: friendRequest.id,
			senderId: friendRequest.senderId,
			receiverId: friendRequest.receiverId,
			status: friendRequest.status
		})
		.from(friendRequest)
		.where(eq(friendRequest.id, requestId))
		.limit(1);

	if (!existing) throw error(404, 'Friend request not found');
	if (existing.receiverId !== userId) throw error(403, 'Not your friend request to accept');
	if (existing.status !== 'PENDING') throw error(400, 'Friend request is no longer pending');

	await db.transaction(async (tx) => {
		await tx
			.update(friendRequest)
			.set({ status: 'ACCEPTED', respondedAt: new Date() })
			.where(eq(friendRequest.id, requestId));

		await tx
			.insert(userFriend)
			.values([
				{ userId: existing.receiverId, friendId: existing.senderId },
				{ userId: existing.senderId, friendId: existing.receiverId }
			])
			.onConflictDoNothing();
	});

	const [receiverUser] = await db
		.select({ username: user.username, name: user.name })
		.from(user)
		.where(eq(user.id, existing.receiverId))
		.limit(1);
	const receiverName = receiverUser?.name || receiverUser?.username || 'Someone';

	createNotification(
		existing.senderId.toString(),
		'FRIEND_ACCEPTED',
		'Friend request accepted',
		`${receiverName} accepted your friend request`,
		`/user/${existing.receiverId}`
	);

	const [senderFriendCount, receiverFriendCount] = await Promise.all([
		getFriendCount(existing.senderId),
		getFriendCount(existing.receiverId)
	]);
	checkAndAwardAchievements(existing.senderId, ['social'], { friendCount: senderFriendCount });
	checkAndAwardAchievements(existing.receiverId, ['social'], { friendCount: receiverFriendCount });

	return json({ success: true });
};
