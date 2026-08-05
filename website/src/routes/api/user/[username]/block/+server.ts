import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { userBlock, user, userFollow, userFriend, friendRequest } from '$lib/server/db/schema';
import { eq, and, or } from 'drizzle-orm';

export async function POST({
	request,
	params
}: {
	request: Request;
	params: { username: string };
}) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const blockerId = Number(session.user.id);
	const targetUsername = params.username;

	const [targetUser] = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.username, targetUsername))
		.limit(1);

	if (!targetUser) throw error(404, 'User not found');
	if (targetUser.id === blockerId) throw error(400, 'Cannot block yourself');

	await db.insert(userBlock).values({ blockerId, blockedId: targetUser.id }).onConflictDoNothing();

	// A block removes any existing follow/friendship/pending request between the two
	// users in either direction, so a block can never be worked around by an existing
	// relationship that predates it.
	await Promise.all([
		db
			.delete(userFollow)
			.where(
				or(
					and(eq(userFollow.followerId, blockerId), eq(userFollow.followingId, targetUser.id)),
					and(eq(userFollow.followerId, targetUser.id), eq(userFollow.followingId, blockerId))
				)
			),
		db
			.delete(userFriend)
			.where(
				or(
					and(eq(userFriend.userId, blockerId), eq(userFriend.friendId, targetUser.id)),
					and(eq(userFriend.userId, targetUser.id), eq(userFriend.friendId, blockerId))
				)
			),
		db
			.delete(friendRequest)
			.where(
				or(
					and(eq(friendRequest.senderId, blockerId), eq(friendRequest.receiverId, targetUser.id)),
					and(eq(friendRequest.senderId, targetUser.id), eq(friendRequest.receiverId, blockerId))
				)
			)
	]);

	return json({ success: true });
}

export async function DELETE({
	request,
	params
}: {
	request: Request;
	params: { username: string };
}) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const blockerId = Number(session.user.id);
	const targetUsername = params.username;

	const [targetUser] = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.username, targetUsername))
		.limit(1);

	if (!targetUser) throw error(404, 'User not found');

	await db
		.delete(userBlock)
		.where(and(eq(userBlock.blockerId, blockerId), eq(userBlock.blockedId, targetUser.id)));

	return json({ success: true });
}
