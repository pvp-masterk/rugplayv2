import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { userFollow, user } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getBlockedSet, getBlockedBySet } from '$lib/server/blocks';
import { createNotification } from '$lib/server/notification';
import { checkAndAwardAchievements } from '$lib/server/achievements';
import { getFollowerCount, getFollowingCount } from '$lib/server/friends';

export async function POST({
	request,
	params
}: {
	request: Request;
	params: { username: string };
}) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const followerId = Number(session.user.id);
	const targetUsername = params.username;

	const [targetUser] = await db
		.select({ id: user.id, username: user.username, disableFollowNotifications: user.disableFollowNotifications })
		.from(user)
		.where(eq(user.username, targetUsername))
		.limit(1);

	if (!targetUser) throw error(404, 'User not found');
	if (targetUser.id === followerId) throw error(400, 'Cannot follow yourself');

	const [blockedSet, blockedBySet] = await Promise.all([
		getBlockedSet(followerId),
		getBlockedBySet(followerId)
	]);
	if (blockedSet.has(targetUser.id) || blockedBySet.has(targetUser.id)) {
		throw error(400, 'Cannot follow this user');
	}

	const inserted = await db
		.insert(userFollow)
		.values({ followerId, followingId: targetUser.id })
		.onConflictDoNothing()
		.returning({ id: userFollow.id });

	if (inserted.length > 0) {
		if (!targetUser.disableFollowNotifications) {
			const followerUser = await db
				.select({ username: user.username, name: user.name })
				.from(user)
				.where(eq(user.id, followerId))
				.limit(1);
			const followerName = followerUser[0]?.name || followerUser[0]?.username || 'Someone';

			createNotification(
				targetUser.id.toString(),
				'NEW_FOLLOWER',
				'New follower',
				`${followerName} started following you`,
				`/user/${followerId}`
			);
		}

		const [followerCount, followingCount] = await Promise.all([
			getFollowerCount(targetUser.id),
			getFollowingCount(followerId)
		]);
		checkAndAwardAchievements(targetUser.id, ['social'], { followerCount });
		checkAndAwardAchievements(followerId, ['social'], { followingCount });
	}

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

	const followerId = Number(session.user.id);
	const targetUsername = params.username;

	const [targetUser] = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.username, targetUsername))
		.limit(1);

	if (!targetUser) throw error(404, 'User not found');

	await db
		.delete(userFollow)
		.where(and(eq(userFollow.followerId, followerId), eq(userFollow.followingId, targetUser.id)));

	return json({ success: true });
}
