import { auth } from "$lib/auth";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { redirect, type Handle } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { checkRateLimit } from '$lib/server/ratelimit';

// Background jobs (resolveExpiredQuestions, processAccountDeletions,
// rolloverSeasons, cleanupExpiredSessions, mines/tower cleanup) now run via
// Vercel Cron hitting /api/cron/scheduled and /api/cron/games — see
// vercel.json. They used to run on setInterval here, but serverless
// functions don't stay warm long enough for that to be reliable, and every
// cold start was re-racing for the Redis lock and logging
// "Scheduler already running" noise.

const RATE_RULES: Array<{
    match: (path: string, method: string) => boolean;
    key: string;
    limit: number;
    windowSecs: number;
}> = [
    {
        match: (p) => p.startsWith('/api/arcade/'),
        key: 'arcade',
        limit: 10,
        windowSecs: 5
    },
    {
        match: (p) => p.endsWith('/trade'),
        key: 'trade',
        limit: 20,
        windowSecs: 60
    },
    {
        match: (p, m) => p.includes('/comments') && m === 'POST',
        key: 'comments',
        limit: 5,
        windowSecs: 60
    },
    {
        match: (p) => p.endsWith('/bet'),
        key: 'bet',
        limit: 10,
        windowSecs: 60
    }
];

const sessionCache = new Map<string, {
    userData: any;
    timestamp: number;
    ttl: number;
}>();

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const CACHE_CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes

setInterval(() => {
    const now = Date.now();
    for (const [key, value] of sessionCache.entries()) {
        if (now - value.timestamp > value.ttl) {
            sessionCache.delete(key);
        }
    }
}, CACHE_CLEANUP_INTERVAL);

export const handle: Handle = async ({ event, resolve }) => {
    if (event.url.pathname.startsWith('/.well-known/appspecific/com.chrome.devtools')) {
        return new Response(null, { status: 204 });
    }

    // Get session from auth
    const session = await auth.api.getSession({
        headers: event.request.headers
    });

    let userData = null;

    if (session?.user) {
        const userId = session.user.id;
        const cacheKey = `user:${userId}`;
        const now = Date.now();
        
        const cached = sessionCache.get(cacheKey);
        if (cached && (now - cached.timestamp) < cached.ttl) {
            userData = cached.userData;
        } else {
            const [userRecord] = await db
                .select({
                    id: user.id,
                    name: user.name,
                    username: user.username,
                    email: user.email,
                    isAdmin: user.isAdmin,
                    image: user.image,
                    isBanned: user.isBanned,
                    banReason: user.banReason,
                    baseCurrencyBalance: user.baseCurrencyBalance,
                    bio: user.bio,
                    volumeMaster: user.volumeMaster,
                    volumeMuted: user.volumeMuted,
                    nameColor: user.nameColor,
                    founderBadge: user.founderBadge,
                    prestigeLevel: user.prestigeLevel,
                    disableMentions: user.disableMentions
                })
                .from(user)
                .where(eq(user.id, Number(userId)))
                .limit(1);

            if (userRecord?.isBanned) {
                try {
                    await auth.api.signOut({
                        headers: event.request.headers
                    });
                } catch (e) {
                    console.error('Failed to sign out banned user:', e);
                }

                if (event.url.pathname !== '/banned') {
                    const banReason = encodeURIComponent(userRecord.banReason || 'Account suspended');
                    throw redirect(302, `/banned?reason=${banReason}`);
                }
            } else if (userRecord) {
                userData = {
                    id: userRecord.id.toString(),
                    name: userRecord.name,
                    username: userRecord.username,
                    email: userRecord.email,
                    isAdmin: userRecord.isAdmin || false,
                    image: userRecord.image || '',
                    isBanned: userRecord.isBanned || false,
                    banReason: userRecord.banReason,
                    avatarUrl: userRecord.image,
                    baseCurrencyBalance: parseFloat(userRecord.baseCurrencyBalance || '0'),
                    bio: userRecord.bio || '',
                    volumeMaster: parseFloat(userRecord.volumeMaster || '0.7'),
                    volumeMuted: userRecord.volumeMuted || false,
                    nameColor: userRecord.nameColor ?? null,
                    founderBadge: userRecord.founderBadge ?? false,
                    prestigeLevel: userRecord.prestigeLevel ?? 0,
                    disableMentions: userRecord.disableMentions ?? false
                };

                const cacheTTL = userRecord.isAdmin ? CACHE_TTL * 2 : CACHE_TTL;
                sessionCache.set(cacheKey, {
                    userData,
                    timestamp: now,
                    ttl: cacheTTL
                });
            }
        }
    }

    event.locals.userSession = userData;

    if (userData && event.url.pathname.startsWith('/api/')) {
        const path = event.url.pathname;
        const method = event.request.method;
        for (const rule of RATE_RULES) {
            if (rule.match(path, method)) {
                const allowed = await checkRateLimit(userData.id, rule.key, rule.limit, rule.windowSecs);
                if (!allowed) {
                    return new Response(
                        JSON.stringify({ error: 'Too many requests' }),
                        { status: 429, headers: { 'Content-Type': 'application/json' } }
                    );
                }
                break;
            }
        }
    }

    if (event.url.pathname.startsWith('/api/') && !event.url.pathname.startsWith('/api/proxy/')) {
        const response = await svelteKitHandler({ event, resolve, auth });
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');

        return response;
    }

    return svelteKitHandler({ event, resolve, auth });
};

export function clearUserCache(userId: string) {
    sessionCache.delete(`user:${userId}`);
}