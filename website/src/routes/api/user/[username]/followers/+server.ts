import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { userFollow, user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getFollowingIdsSet, getFriendIdsSet } from '$lib/server/friends';
import type { RequestHandler } from './$types';

// v1: no offset pagination yet, just a sane limit. If this list ever needs to page,
// add ?offset= here following whatever convention the rest of the API settles on.
const DEFAULT_LIMIT = 50;

export const GET: RequestHandler = async ({ request, params, url }) => {
	const targetUsername = params.username;
	const limit = Math.min(Number(url.searchParams.get('limit')) || DEFAULT_LIMIT, 100);

	const [targetUser] = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.username, targetUsername))
		.limit(1);

	if (!targetUser) throw error(404, 'User not found');

	const followers = await db
		.select({
			id: user.id,
			username: user.username,
			name: user.name,
			image: user.image,
			nameColor: user.nameColor,
			followedAt: userFollow.createdAt
		})
		.from(userFollow)
		.innerJoin(user, eq(userFollow.followerId, user.id))
		.where(eq(userFollow.followingId, targetUser.id))
		.orderBy(userFollow.createdAt)
		.limit(limit);

	const session = await auth.api.getSession({ headers: request.headers });
	let viewerFollowingSet = new Set<number>();
	let viewerFriendSet = new Set<number>();
	if (session?.user) {
		const viewerId = Number(session.user.id);
		[viewerFollowingSet, viewerFriendSet] = await Promise.all([
			getFollowingIdsSet(viewerId),
			getFriendIdsSet(viewerId)
		]);
	}

	return json({
		followers: followers.map((f) => ({
			...f,
			viewerIsFollowing: viewerFollowingSet.has(f.id),
			viewerIsFriend: viewerFriendSet.has(f.id)
		}))
	});
};
