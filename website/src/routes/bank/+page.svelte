<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { PiggyBankIcon, TradeUpIcon, TradeDownIcon } from '@hugeicons/core-free-icons';
	import CoinIcon from '$lib/components/self/CoinIcon.svelte';
	import SEO from '$lib/components/self/SEO.svelte';
	import { formatValue, formatPrice, formatMarketCap } from '$lib/utils';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let loading = $state(true);
	let error = $state<string | null>(null);
	let treasuryData = $state<any>(null);
	let ledger = $state<any[]>([]);
	let bankCoin = $state<any>(null);

	const SOURCE_LABELS: Record<string, string> = {
		TRADING_FEE: 'Trading fee',
		CASH_TRANSFER_FEE: 'Transfer fee',
		DAILY_REWARD: 'Daily reward payout',
		ARCADE_HOUSE_EDGE: 'Arcade house edge',
		ARCADE_PAYOUT: 'Arcade payout',
		PROMO_CODE: 'Promo code',
		PREDICTION_MARKET_FEE: 'Prediction market fee',
		ADMIN_ADJUSTMENT: 'Admin adjustment',
		SEED: 'Initial capitalization'
	};

	onMount(async () => {
		try {
			const response = await fetch('/api/treasury');
			if (!response.ok) throw new Error('Failed to load treasury data');
			const data = await response.json();
			treasuryData = data.treasury;
			ledger = data.ledger;
			bankCoin = data.bankCoin;
		} catch (e) {
			console.error('Failed to fetch treasury data:', e);
			error = 'Failed to load bank data';
		} finally {
			loading = false;
		}
	});
</script>

<SEO
	title="RugPlay Bank"
	description="The central treasury behind Rugplay's economy — every trading fee and transfer fee flows in, every daily reward flows out. Fully transparent, publicly auditable."
	keywords="rugplay bank, central bank, treasury, official coin"
/>

<div class="container mx-auto max-w-4xl p-6">
	<header class="mb-8 flex items-center gap-3">
		<div class="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-full">
			<HugeiconsIcon icon={PiggyBankIcon} class="text-primary h-6 w-6" />
		</div>
		<div>
			<h1 class="text-3xl font-bold">RugPlay Bank</h1>
			<p class="text-muted-foreground text-sm">
				The treasury behind the economy — where fees go, where payouts come from.
			</p>
		</div>
	</header>

	{#if loading}
		<div class="grid grid-cols-1 gap-6 sm:grid-cols-3">
			{#each Array(3) as _}
				<Card.Root><Card.Content class="pt-6"><Skeleton class="h-16 w-full" /></Card.Content></Card.Root>
			{/each}
		</div>
	{:else if error}
		<div class="text-muted-foreground py-12 text-center">{error}</div>
	{:else}
		<!-- Treasury balance -->
		<div class="grid grid-cols-1 gap-6 sm:grid-cols-3">
			<Card.Root>
				<Card.Header class="pb-2">
					<Card.Title class="text-muted-foreground text-sm font-normal">Treasury Balance</Card.Title>
				</Card.Header>
				<Card.Content>
					<p class="text-2xl font-bold {treasuryData.balance < 0 ? 'text-destructive' : ''}">
						{formatValue(treasuryData.balance)}
					</p>
					{#if treasuryData.balance < 0}
						<p class="text-destructive mt-1 text-xs">
							Payouts have outrun fee income — running a deficit.
						</p>
					{/if}
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Header class="pb-2">
					<Card.Title class="text-muted-foreground text-sm font-normal">Total Inflow</Card.Title>
				</Card.Header>
				<Card.Content>
					<div class="flex items-center gap-1.5">
						<HugeiconsIcon icon={TradeUpIcon} class="h-4 w-4 text-green-500" />
						<p class="text-2xl font-bold">{formatValue(treasuryData.totalInflow)}</p>
					</div>
					<p class="text-muted-foreground mt-1 text-xs">Trading fees + transfer fees, all time</p>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Header class="pb-2">
					<Card.Title class="text-muted-foreground text-sm font-normal">Total Outflow</Card.Title>
				</Card.Header>
				<Card.Content>
					<div class="flex items-center gap-1.5">
						<HugeiconsIcon icon={TradeDownIcon} class="h-4 w-4 text-red-500" />
						<p class="text-2xl font-bold">{formatValue(treasuryData.totalOutflow)}</p>
					</div>
					<p class="text-muted-foreground mt-1 text-xs">Daily reward payouts, all time</p>
				</Card.Content>
			</Card.Root>
		</div>

		<!-- Official coin -->
		{#if bankCoin}
			<div class="mt-8">
				<h2 class="mb-4 text-xl font-bold">The Official Coin</h2>
				<Card.Root
					class="hover:bg-card/50 cursor-pointer transition-all hover:shadow-md"
					onclick={() => goto(`/coin/${bankCoin.symbol}`)}
				>
					<Card.Content class="flex flex-wrap items-center justify-between gap-4 pt-6">
						<div class="flex items-center gap-3">
							<CoinIcon icon={bankCoin.icon} symbol={bankCoin.symbol} name={bankCoin.name} size={12} />
							<div>
								<div class="flex items-center gap-2">
									<span class="text-lg font-semibold">{bankCoin.name}</span>
									<Badge
										variant="outline"
										class="border-amber-500/60 bg-amber-500/10 text-[10px] font-semibold text-amber-600 dark:text-amber-400"
									>
										✓ OFFICIAL
									</Badge>
								</div>
								<p class="text-muted-foreground text-sm">*{bankCoin.symbol}</p>
							</div>
						</div>
						<div class="text-right">
							<p class="text-xl font-bold">${formatPrice(bankCoin.currentPrice)}</p>
							<Badge variant={bankCoin.change24h >= 0 ? 'success' : 'destructive'} class="mt-1">
								{bankCoin.change24h >= 0 ? '+' : ''}{bankCoin.change24h.toFixed(2)}%
							</Badge>
						</div>
						<div class="text-right">
							<p class="text-muted-foreground text-xs">Market Cap</p>
							<p class="font-mono text-sm font-medium">{formatMarketCap(bankCoin.marketCap)}</p>
						</div>
					</Card.Content>
				</Card.Root>
				{#if bankCoin.maxHolderPercent}
					<p class="text-muted-foreground mt-2 text-xs">
						No wallet can hold more than {bankCoin.maxHolderPercent}% of the
						{bankCoin.circulatingSupply.toLocaleString()} total shares — issued with no owner, capped
						supply, by design.
					</p>
				{/if}
			</div>
		{/if}

		<!-- Ledger -->
		<div class="mt-8">
			<h2 class="mb-4 text-xl font-bold">Recent Activity</h2>
			<Card.Root>
				<Card.Content class="pt-6">
					{#if ledger.length === 0}
						<p class="text-muted-foreground py-8 text-center text-sm">No treasury activity yet.</p>
					{:else}
						<div class="divide-y">
							{#each ledger as entry (entry.id)}
								<div class="flex items-center justify-between gap-3 py-3 text-sm">
									<div class="min-w-0">
										<p class="truncate font-medium">
											{entry.description || SOURCE_LABELS[entry.source] || entry.source}
										</p>
										<p class="text-muted-foreground text-xs">
											{SOURCE_LABELS[entry.source] || entry.source}
											{#if entry.username}
												· @{entry.username}
											{/if}
											· {new Date(entry.createdAt).toLocaleString()}
										</p>
									</div>
									<span
										class="shrink-0 font-mono font-medium {entry.direction === 'IN'
											? 'text-green-500'
											: 'text-red-500'}"
									>
										{entry.direction === 'IN' ? '+' : '−'}{formatValue(entry.amount)}
									</span>
								</div>
							{/each}
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		</div>
	{/if}
</div>
