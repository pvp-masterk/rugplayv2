import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { userFriend, user } from '$lib/server/db/schema';
import { eq, and, or } from 'drizzle-orm';
import type { RequestHandler } from './$types';

// Unfriend deletes both directional userFriend rows atomically. This intentionally does
// NOT touch userFollow rows - friendship and following are independent, so unfriending
// someone should never silently unfollow them. See schema.ts comment on userFriend.
export const DELETE: RequestHandler = async ({ request, params }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const userId = Number(session.user.id);
	const targetUsername = params.username;

	const [targetUser] = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.username, targetUsername))
		.limit(1);

	if (!targetUser) throw error(404, 'User not found');

	await db
		.delete(userFriend)
		.where(
			or(
				and(eq(userFriend.userId, userId), eq(userFriend.friendId, targetUser.id)),
				and(eq(userFriend.userId, targetUser.id), eq(userFriend.friendId, userId))
			)
		);

	return json({ success: true });
};
