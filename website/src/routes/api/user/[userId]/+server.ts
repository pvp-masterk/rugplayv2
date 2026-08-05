import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user, coin, transaction, userPortfolio } from '$lib/server/db/schema';
import { eq, desc, sql, count, and, gte } from 'drizzle-orm';
import { getUserTrophies, getBestTrophy } from '$lib/server/seasons';
import { auth } from '$lib/auth';
import {
    getFollowerCount,
    getFollowingCount,
    getFriendCount,
    isFollowing,
    areFriends,
    hasPendingRequestBetween
} from '$lib/server/friends';

export async function GET({ params, request }) {
    const { userId } = params;

    if (!userId) {
        throw error(400, 'User ID or username is required');
    }

    try {
        const isNumeric = /^\d+$/.test(userId);

        const userProfile = await db.query.user.findFirst({
            where: isNumeric ? eq(user.id, parseInt(userId)) : eq(user.username, userId),
            columns: {
                id: true,
                name: true,
                username: true,
                bio: true,
                image: true,
                createdAt: true,
                baseCurrencyBalance: true,
                isAdmin: true,
                loginStreak: true,
                prestigeLevel: true,
                halloweenBadge2025: true,
                arcadeWins: true,
                arcadeLosses: true,
                nameColor: true,
                founderBadge: true,
            }
        });

        if (!userProfile) {
            throw error(404, 'User not found');
        }

        const actualUserId = userProfile.id;

        // get created coins
        const createdCoins = await db
            .select({
                id: coin.id,
                name: coin.name,
                symbol: coin.symbol,
                icon: coin.icon,
                currentPrice: coin.currentPrice,
                marketCap: coin.marketCap,
                volume24h: coin.volume24h,
                change24h: coin.change24h,
                createdAt: coin.createdAt,
            })
            .from(coin)
            .where(eq(coin.creatorId, actualUserId))
            .orderBy(desc(coin.createdAt))
            .limit(10);

        // get portfolio value and holdings count
        const portfolioHoldings = await db
            .select({
                quantity: userPortfolio.quantity,
                currentPrice: coin.currentPrice
            })
            .from(userPortfolio)
            .innerJoin(coin, eq(userPortfolio.coinId, coin.id))
            .where(eq(userPortfolio.userId, actualUserId));

        const holdingsValue = portfolioHoldings.reduce((total, holding) => {
            const quantity = Number(holding.quantity);
            const price = Number(holding.currentPrice);
            return total + (quantity * price);
        }, 0);

        const portfolioStats = {
            holdingsCount: portfolioHoldings.length,
            totalValue: holdingsValue
        };

        const recentTransactions = await db
            .select({
                id: transaction.id,
                type: transaction.type,
                coinSymbol: coin.symbol,
                coinName: coin.name,
                coinIcon: coin.icon,
                quantity: transaction.quantity,
                pricePerCoin: transaction.pricePerCoin,
                totalBaseCurrencyAmount: transaction.totalBaseCurrencyAmount,
                timestamp: transaction.timestamp,
                senderUsername: sql<string>`(SELECT username FROM ${user} WHERE id = ${transaction.senderUserId})`,
                recipientUsername: sql<string>`(SELECT username FROM ${user} WHERE id = ${transaction.recipientUserId})`,
                senderUserId: transaction.senderUserId,
                recipientUserId: transaction.recipientUserId,
            })
            .from(transaction)
            .innerJoin(coin, eq(transaction.coinId, coin.id))
            .where(eq(transaction.userId, actualUserId))
            .orderBy(desc(transaction.timestamp))
            .limit(10);

        const baseCurrencyBalance = parseFloat(userProfile.baseCurrencyBalance);
        const calculatedHoldingsValue = portfolioStats.totalValue || 0;
        const totalPortfolioValue = baseCurrencyBalance + calculatedHoldingsValue;

        // get all transaction statistics
        const transactionStats = await db
            .select({
                totalTransactions: count(),
                totalBuyVolume: sql<number>`COALESCE(SUM(CASE WHEN ${transaction.type} = 'BUY' THEN CAST(${transaction.totalBaseCurrencyAmount} AS NUMERIC) ELSE 0 END), 0)`,
                totalSellVolume: sql<number>`COALESCE(SUM(CASE WHEN ${transaction.type} = 'SELL' THEN CAST(${transaction.totalBaseCurrencyAmount} AS NUMERIC) ELSE 0 END), 0)`
            })
            .from(transaction)
            .where(eq(transaction.userId, actualUserId));

        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const transactionStats24h = await db
            .select({
                transactions24h: count(),
                buyVolume24h: sql<number>`COALESCE(SUM(CASE WHEN ${transaction.type} = 'BUY' THEN CAST(${transaction.totalBaseCurrencyAmount} AS NUMERIC) ELSE 0 END), 0)`,
                sellVolume24h: sql<number>`COALESCE(SUM(CASE WHEN ${transaction.type} = 'SELL' THEN CAST(${transaction.totalBaseCurrencyAmount} AS NUMERIC) ELSE 0 END), 0)`
            })
            .from(transaction)
            .where(
                and(
                    eq(transaction.userId, actualUserId),
                    gte(transaction.timestamp, twentyFourHoursAgo)
                )
            );

        const [seasonTrophies, { bestTrophy, trophyCount }, followerCount, followingCount, friendCount] = await Promise.all([
            getUserTrophies(actualUserId),
            getBestTrophy(actualUserId),
            getFollowerCount(actualUserId),
            getFollowingCount(actualUserId),
            getFriendCount(actualUserId)
        ]);

        // Viewer-relationship fields: only computed when there's an authenticated
        // session and the viewer isn't looking at their own profile. Avoids extra
        // round-trips from the profile page for follow/friend button state.
        let viewerIsFollowing: boolean | undefined;
        let viewerIsFollowedBy: boolean | undefined;
        let viewerFriendshipStatus: 'none' | 'friends' | 'pending_outgoing' | 'pending_incoming' | undefined;

        const session = await auth.api.getSession({ headers: request.headers });
        if (session?.user) {
            const viewerId = Number(session.user.id);
            if (viewerId !== actualUserId) {
                const [followingThem, followedByThem, friends, pending] = await Promise.all([
                    isFollowing(viewerId, actualUserId),
                    isFollowing(actualUserId, viewerId),
                    areFriends(viewerId, actualUserId),
                    hasPendingRequestBetween(viewerId, actualUserId)
                ]);

                viewerIsFollowing = followingThem;
                viewerIsFollowedBy = followedByThem;

                if (friends) {
                    viewerFriendshipStatus = 'friends';
                } else if (pending.direction === 'outgoing') {
                    viewerFriendshipStatus = 'pending_outgoing';
                } else if (pending.direction === 'incoming') {
                    viewerFriendshipStatus = 'pending_incoming';
                } else {
                    viewerFriendshipStatus = 'none';
                }
            }
        }

        return json({
            profile: {
                ...userProfile,
                baseCurrencyBalance,
                totalPortfolioValue,
                bestTrophy,
                trophyCount,
                seasonTrophies,
                followerCount,
                followingCount,
                friendCount,
                ...(viewerIsFollowing !== undefined ? { viewerIsFollowing } : {}),
                ...(viewerIsFollowedBy !== undefined ? { viewerIsFollowedBy } : {}),
                ...(viewerFriendshipStatus !== undefined ? { viewerFriendshipStatus } : {})
            }, stats: {
                totalPortfolioValue,
                baseCurrencyBalance,
                holdingsValue: calculatedHoldingsValue,
                holdingsCount: portfolioStats.holdingsCount || 0,
                coinsCreated: createdCoins.length,
                followerCount,
                followingCount,
                friendCount,
                totalTransactions: transactionStats[0]?.totalTransactions || 0,
                totalBuyVolume: transactionStats[0]?.totalBuyVolume || 0,
                totalSellVolume: transactionStats[0]?.totalSellVolume || 0,
                transactions24h: transactionStats24h[0]?.transactions24h || 0,
                buyVolume24h: transactionStats24h[0]?.buyVolume24h || 0,
                sellVolume24h: transactionStats24h[0]?.sellVolume24h || 0,
            },
            createdCoins,
            recentTransactions,
            seasonTrophies
        });
    } catch (e) {
        console.error('Failed to fetch user profile:', e);
        throw error(500, 'Failed to fetch user profile');
    }
}
