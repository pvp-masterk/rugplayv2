import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { friendRequest, userFriend, user } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getBlockedSet, getBlockedBySet } from '$lib/server/blocks';
import { areFriends, hasPendingRequestBetween, getFriendCount } from '$lib/server/friends';
import { createNotification } from '$lib/server/notification';
import { checkAndAwardAchievements } from '$lib/server/achievements';

export async function POST({
	request,
	params
}: {
	request: Request;
	params: { username: string };
}) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const senderId = Number(session.user.id);
	const targetUsername = params.username;

	const [targetUser] = await db
		.select({ id: user.id, username: user.username, name: user.name })
		.from(user)
		.where(eq(user.username, targetUsername))
		.limit(1);

	if (!targetUser) throw error(404, 'User not found');
	if (targetUser.id === senderId) throw error(400, 'Cannot send a friend request to yourself');

	const [blockedSet, blockedBySet] = await Promise.all([
		getBlockedSet(senderId),
		getBlockedBySet(senderId)
	]);
	if (blockedSet.has(targetUser.id) || blockedBySet.has(targetUser.id)) {
		throw error(400, 'Cannot send a friend request to this user');
	}

	if (await areFriends(senderId, targetUser.id)) {
		throw error(400, 'Already friends');
	}

	const pending = await hasPendingRequestBetween(senderId, targetUser.id);

	// If the target already sent a request to us, treat this as an accept rather than
	// creating a duplicate/second request.
	if (pending.direction === 'incoming' && pending.requestId) {
		const requestId = pending.requestId;

		await db.transaction(async (tx) => {
			await tx
				.update(friendRequest)
				.set({ status: 'ACCEPTED', respondedAt: new Date() })
				.where(eq(friendRequest.id, requestId));

			await tx
				.insert(userFriend)
				.values([
					{ userId: senderId, friendId: targetUser.id },
					{ userId: targetUser.id, friendId: senderId }
				])
				.onConflictDoNothing();
		});

		const [acceptingUser] = await db
			.select({ username: user.username, name: user.name })
			.from(user)
			.where(eq(user.id, senderId))
			.limit(1);
		const acceptingName = acceptingUser?.name || acceptingUser?.username || 'Someone';

		createNotification(
			targetUser.id.toString(),
			'FRIEND_ACCEPTED',
			'Friend request accepted',
			`${acceptingName} accepted your friend request`,
			`/user/${senderId}`
		);

		const [senderFriendCount, targetFriendCount] = await Promise.all([
			getFriendCount(senderId),
			getFriendCount(targetUser.id)
		]);
		checkAndAwardAchievements(senderId, ['social'], { friendCount: senderFriendCount });
		checkAndAwardAchievements(targetUser.id, ['social'], { friendCount: targetFriendCount });

		return json({ success: true, status: 'accepted' });
	}

	if (pending.direction === 'outgoing') {
		throw error(400, 'Friend request already pending');
	}

	const [senderUser] = await db
		.select({ username: user.username, name: user.name })
		.from(user)
		.where(eq(user.id, senderId))
		.limit(1);
	const senderName = senderUser?.name || senderUser?.username || 'Someone';

	await db.insert(friendRequest).values({ senderId, receiverId: targetUser.id });

	createNotification(
		targetUser.id.toString(),
		'FRIEND_REQUEST',
		'New friend request',
		`${senderName} sent you a friend request`,
		'/friends'
	);

	return json({ success: true, status: 'pending' });
}
