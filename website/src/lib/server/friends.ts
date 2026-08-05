import { db } from './db';
import { userFriend, userFollow, friendRequest } from './db/schema';
import { eq, and, count } from 'drizzle-orm';

export async function getFriendIdsSet(userId: number): Promise<Set<number>> {
	const rows = await db
		.select({ friendId: userFriend.friendId })
		.from(userFriend)
		.where(eq(userFriend.userId, userId));
	return new Set(rows.map((r) => r.friendId));
}

export async function areFriends(userIdA: number, userIdB: number): Promise<boolean> {
	const [row] = await db
		.select({ id: userFriend.id })
		.from(userFriend)
		.where(and(eq(userFriend.userId, userIdA), eq(userFriend.friendId, userIdB)))
		.limit(1);
	return !!row;
}

export async function getFollowingIdsSet(userId: number): Promise<Set<number>> {
	const rows = await db
		.select({ followingId: userFollow.followingId })
		.from(userFollow)
		.where(eq(userFollow.followerId, userId));
	return new Set(rows.map((r) => r.followingId));
}

export async function getFollowerIdsSet(userId: number): Promise<Set<number>> {
	const rows = await db
		.select({ followerId: userFollow.followerId })
		.from(userFollow)
		.where(eq(userFollow.followingId, userId));
	return new Set(rows.map((r) => r.followerId));
}

export async function isFollowing(followerId: number, followingId: number): Promise<boolean> {
	const [row] = await db
		.select({ id: userFollow.id })
		.from(userFollow)
		.where(and(eq(userFollow.followerId, followerId), eq(userFollow.followingId, followingId)))
		.limit(1);
	return !!row;
}

export async function getPendingIncomingRequestCount(userId: number): Promise<number> {
	const [result] = await db
		.select({ cnt: count() })
		.from(friendRequest)
		.where(and(eq(friendRequest.receiverId, userId), eq(friendRequest.status, 'PENDING')));
	return Number(result?.cnt ?? 0);
}

export async function hasPendingRequestBetween(
	userIdA: number,
	userIdB: number
): Promise<{ direction: 'outgoing' | 'incoming' | null; requestId: number | null }> {
	const [outgoing] = await db
		.select({ id: friendRequest.id })
		.from(friendRequest)
		.where(
			and(
				eq(friendRequest.senderId, userIdA),
				eq(friendRequest.receiverId, userIdB),
				eq(friendRequest.status, 'PENDING')
			)
		)
		.limit(1);
	if (outgoing) return { direction: 'outgoing', requestId: outgoing.id };

	const [incoming] = await db
		.select({ id: friendRequest.id })
		.from(friendRequest)
		.where(
			and(
				eq(friendRequest.senderId, userIdB),
				eq(friendRequest.receiverId, userIdA),
				eq(friendRequest.status, 'PENDING')
			)
		)
		.limit(1);
	if (incoming) return { direction: 'incoming', requestId: incoming.id };

	return { direction: null, requestId: null };
}

export async function getFriendCount(userId: number): Promise<number> {
	const [result] = await db
		.select({ cnt: count() })
		.from(userFriend)
		.where(eq(userFriend.userId, userId));
	return Number(result?.cnt ?? 0);
}

export async function getFollowerCount(userId: number): Promise<number> {
	const [result] = await db
		.select({ cnt: count() })
		.from(userFollow)
		.where(eq(userFollow.followingId, userId));
	return Number(result?.cnt ?? 0);
}

export async function getFollowingCount(userId: number): Promise<number> {
	const [result] = await db
		.select({ cnt: count() })
		.from(userFollow)
		.where(eq(userFollow.followerId, userId));
	return Number(result?.cnt ?? 0);
}
