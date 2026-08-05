import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { minesCleanupInactiveGames, minesAutoCashout } from '$lib/server/games/mines';
import { towerCleanupInactiveGames } from '$lib/server/games/tower';

// Triggered by Vercel Cron (see vercel.json). Replaces the 1-minute
// setInterval that used to run inside hooks.server.ts.
export const GET: RequestHandler = async ({ request }) => {
    const authHeader = request.headers.get('authorization');
    if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
        throw error(401, 'Unauthorized');
    }

    const results = await Promise.allSettled([
        minesCleanupInactiveGames(),
        minesAutoCashout(),
        towerCleanupInactiveGames()
    ]);

    const failures = results
        .map((r, i) => ({ r, i }))
        .filter(({ r }) => r.status === 'rejected');

    if (failures.length > 0) {
        for (const { r, i } of failures) {
            console.error(`Game cleanup job ${i} failed:`, (r as PromiseRejectedResult).reason);
        }
    }

    return json({
        ok: failures.length === 0,
        ranAt: new Date().toISOString(),
        failures: failures.length
    });
};
