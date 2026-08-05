import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { resolveExpiredQuestions, processAccountDeletions, cleanupExpiredSessions } from '$lib/server/job';
import { rolloverSeasons } from '$lib/server/seasons';

// Triggered by Vercel Cron (see vercel.json). Runs the jobs that previously
// lived on a 5-minute setInterval inside hooks.server.ts. Serverless
// functions don't stay warm, so that interval could silently stop firing
// between invocations — Vercel Cron guarantees the trigger instead.
export const GET: RequestHandler = async ({ request }) => {
    const authHeader = request.headers.get('authorization');
    if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
        throw error(401, 'Unauthorized');
    }

    const results = await Promise.allSettled([
        resolveExpiredQuestions(),
        processAccountDeletions(),
        rolloverSeasons(),
        cleanupExpiredSessions()
    ]);

    const failures = results
        .map((r, i) => ({ r, i }))
        .filter(({ r }) => r.status === 'rejected');

    if (failures.length > 0) {
        for (const { r, i } of failures) {
            console.error(`Scheduled job ${i} failed:`, (r as PromiseRejectedResult).reason);
        }
    }

    return json({
        ok: failures.length === 0,
        ranAt: new Date().toISOString(),
        failures: failures.length
    });
};
