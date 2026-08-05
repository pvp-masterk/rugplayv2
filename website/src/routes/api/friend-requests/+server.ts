import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { friendRequest, user } from '$lib/server/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const userId = Number(session.user.id);

	const [incoming, outgoing] = await Promise.all([
		db
			.select({
				id: friendRequest.id,
				createdAt: friendRequest.createdAt,
				user: {
					id: user.id,
					username: user.username,
					name: user.name,
					image: user.image,
					nameColor: user.nameColor
				}
			})
			.from(friendRequest)
			.innerJoin(user, eq(friendRequest.senderId, user.id))
			.where(and(eq(friendRequest.receiverId, userId), eq(friendRequest.status, 'PENDING')))
			.orderBy(desc(friendRequest.createdAt)),
		db
			.select({
				id: friendRequest.id,
				createdAt: friendRequest.createdAt,
				user: {
					id: user.id,
					username: user.username,
					name: user.name,
					image: user.image,
					nameColor: user.nameColor
				}
			})
			.from(friendRequest)
			.innerJoin(user, eq(friendRequest.receiverId, user.id))
			.where(and(eq(friendRequest.senderId, userId), eq(friendRequest.status, 'PENDING')))
			.orderBy(desc(friendRequest.createdAt))
	]);

	return json({ incoming, outgoing, pendingRequestCount: incoming.length });
};
