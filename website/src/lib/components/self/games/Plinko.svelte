<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import confetti from 'canvas-confetti';
	import { toast } from 'svelte-sonner';
	import {
		formatValue,
		playSound,
		showConfetti,
		showSchoolPrideCannons,
		calculatePlinkoMultipliers,
		plinko_row_options,
		plinko_risk_options,
		type PlinkoRisk,
		type PlinkoRows
	} from '$lib/utils';
	import { volumeSettings } from '$lib/stores/volume-settings';
	import { onMount } from 'svelte';
	import { fetchPortfolioSummary } from '$lib/stores/portfolio-data';
	import { haptic } from '$lib/stores/haptics';

	interface PlinkoResult {
		won: boolean;
		path: number[];
		bucket: number;
		multiplier: number;
		multipliers: number[];
		newBalance: number;
		payout: number;
		amountWagered: number;
	}

	const MAX_BET_AMOUNT = 1000000;

	let {
		balance = $bindable(),
		onBalanceUpdate
	}: {
		balance: number;
		onBalanceUpdate?: (newBalance: number) => void;
	} = $props();

	let betAmount = $state(10);
	let betAmountDisplay = $state('10');
	let rows = $state<PlinkoRows>(12);
	let risk = $state<PlinkoRisk>('medium');
	let isDropping = $state(false);
	let lastResult = $state<PlinkoResult | null>(null);
	let ballPos = $state<{ x: number; y: number } | null>(null);
	let boardEl: HTMLDivElement | null = null;
	let boardWrapperEl: HTMLDivElement | null = null;
	let wrapperWidth = $state(0);

	const PEG_GAP_X = 34;
	const PEG_GAP_Y = 30;
	const TOP_PADDING = 24;

	let previewMultipliers = $derived(calculatePlinkoMultipliers(rows, risk));

	// Scale the board down to fit the available width on smaller screens
	// instead of forcing horizontal scroll.
	let boardScale = $derived(
		wrapperWidth > 0 ? Math.min(1, wrapperWidth / boardWidth(rows)) : 1
	);

	let canBet = $derived(
		betAmount > 0 && betAmount <= balance && betAmount <= MAX_BET_AMOUNT && !isDropping
	);

	function boardWidth(r: number) {
		return (r + 1) * PEG_GAP_X + PEG_GAP_X;
	}

	function selectRows(r: PlinkoRows) {
		if (!isDropping) {
			rows = r;
			haptic.trigger('selection');
			playSound('click');
		}
	}

	function selectRisk(r: PlinkoRisk) {
		if (!isDropping) {
			risk = r;
			haptic.trigger('selection');
			playSound('click');
		}
	}

	function setBetAmount(amount: number) {
		const clampedAmount = Math.min(amount, Math.min(balance, MAX_BET_AMOUNT));
		if (clampedAmount >= 0) {
			betAmount = clampedAmount;
			betAmountDisplay = clampedAmount.toLocaleString();
		}
	}

	function handleBetAmountInput(event: Event) {
		const target = event.target as HTMLInputElement;
		const value = target.value.replace(/,/g, '');
		const numValue = parseFloat(value) || 0;
		const clampedValue = Math.min(numValue, Math.min(balance, MAX_BET_AMOUNT));

		betAmount = clampedValue;
		betAmountDisplay = target.value;
	}

	function handleBetAmountBlur() {
		betAmountDisplay = betAmount.toLocaleString();
	}

	function multiplierClass(mult: number) {
		if (mult >= 5) return 'bg-success/20 text-success';
		if (mult >= 1) return 'bg-muted text-foreground';
		return 'bg-destructive/10 text-destructive';
	}

	async function dropBall() {
		if (!canBet) return;

		isDropping = true;
		lastResult = null;

		try {
			const response = await fetch('/api/arcade/plinko', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					amount: betAmount,
					rows,
					risk
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to place bet');
			}

			const resultData: PlinkoResult = await response.json();

			await animateBall(resultData.path);

			balance = resultData.newBalance;
			lastResult = resultData;
			onBalanceUpdate?.(resultData.newBalance);

			if (resultData.won) {
				haptic.trigger('success');
				playSound('win');
				if (resultData.multiplier >= 5) {
					showConfetti(confetti);
					showSchoolPrideCannons(confetti);
				}
			} else {
				haptic.trigger('error');
				playSound('lose');
			}

			isDropping = false;
		} catch (error) {
			console.error('Plinko drop error:', error);
			haptic.trigger('error');
			toast.error('Drop failed', {
				description: error instanceof Error ? error.message : 'Unknown error occurred'
			});
			isDropping = false;
			ballPos = null;
		}
	}

	async function animateBall(path: number[]) {
		const width = boardWidth(rows);
		const bucketWidth = width / (rows + 1);
		let x = width / 2;

		playSound('click');
		ballPos = { x, y: TOP_PADDING };
		await new Promise((resolve) => setTimeout(resolve, 120));

		for (let i = 0; i < path.length; i++) {
			const bounce = path[i];
			const step = bucketWidth / 2;
			x += bounce === 0 ? -step : step;
			const y = TOP_PADDING + (i + 1) * PEG_GAP_Y;

			ballPos = { x, y };
			playSound('click');
			await new Promise((resolve) => setTimeout(resolve, 90));
		}

		await new Promise((resolve) => setTimeout(resolve, 250));
	}

	onMount(async () => {
		volumeSettings.load();

		try {
			const data = await fetchPortfolioSummary();
			if (data) {
				balance = data.baseCurrencyBalance;
				onBalanceUpdate?.(data.baseCurrencyBalance);
			}
		} catch (error) {
			console.error('Failed to fetch balance:', error);
		}

		if (boardWrapperEl) {
			const updateWidth = () => {
				wrapperWidth = boardWrapperEl?.clientWidth ?? 0;
			};
			updateWidth();

			const resizeObserver = new ResizeObserver(updateWidth);
			resizeObserver.observe(boardWrapperEl);

			return () => resizeObserver.disconnect();
		}
	});
</script>

<Card>
	<CardHeader>
		<CardTitle>Plinko</CardTitle>
		<CardDescription>Drop the ball and see where it lands. Edges pay the most!</CardDescription>
	</CardHeader>
	<CardContent>
		<div class="grid grid-cols-1 gap-8 md:grid-cols-2">
			<div class="flex flex-col space-y-4">
				<div class="text-center">
					<p class="text-muted-foreground text-sm">Balance</p>
					<p class="text-2xl font-bold">{formatValue(balance)}</p>
				</div>

				<div class="w-full" bind:this={boardWrapperEl}>
					<div
						class="mx-auto"
						style="width: {boardWidth(rows) * boardScale}px; height: {(TOP_PADDING +
							(rows + 1) * PEG_GAP_Y) *
							boardScale}px;"
					>
						<div
							class="plinko-board relative"
							style="width: {boardWidth(rows)}px; height: {TOP_PADDING +
								(rows + 1) * PEG_GAP_Y}px; transform: scale({boardScale}); transform-origin: top left;"
							bind:this={boardEl}
						>
							{#each Array(rows) as _, row}
								{#each Array(row + 2) as _, col}
									{@const rowWidth = (row + 2) * PEG_GAP_X}
									{@const offset = (boardWidth(rows) - rowWidth) / 2}
									<div
										class="peg"
										style="left: {offset + col * PEG_GAP_X}px; top: {TOP_PADDING +
											row * PEG_GAP_Y}px;"
									></div>
								{/each}
							{/each}

							{#if ballPos}
								<div class="ball" style="left: {ballPos.x}px; top: {ballPos.y}px;"></div>
							{/if}

							<div class="buckets absolute right-0 bottom-0 left-0 flex">
								{#each previewMultipliers as mult, i}
									<div
										class="flex-1 rounded px-0.5 py-1 text-center text-[10px] font-semibold {multiplierClass(
											mult
										)} {lastResult && !isDropping && lastResult.bucket === i
											? 'ring-primary ring-2'
											: ''}"
									>
										{mult}x
									</div>
								{/each}
							</div>
						</div>
					</div>
				</div>

				<div class="flex items-center justify-center text-center">
					{#if lastResult && !isDropping}
						<div class="bg-muted/50 w-full rounded-lg p-3">
							{#if lastResult.won}
								<p class="text-success font-semibold">WIN</p>
								<p class="text-sm">
									Won {formatValue(lastResult.payout)} at {lastResult.multiplier}x
								</p>
							{:else}
								<p class="text-destructive font-semibold">LOSS</p>
								<p class="text-sm">
									Lost {formatValue(lastResult.amountWagered)} at {lastResult.multiplier}x
								</p>
							{/if}
						</div>
					{/if}
				</div>
			</div>

			<div class="space-y-4">
				<div>
					<div class="mb-2 block text-sm font-medium">Rows</div>
					<div class="grid grid-cols-3 gap-2">
						{#each plinko_row_options as r}
							<Button
								variant={rows === r ? 'default' : 'outline'}
								onclick={() => selectRows(r)}
								disabled={isDropping}
							>
								{r}
							</Button>
						{/each}
					</div>
				</div>

				<div>
					<div class="mb-2 block text-sm font-medium">Risk</div>
					<div class="grid grid-cols-3 gap-2">
						{#each plinko_risk_options as opt}
							<Button
								variant={risk === opt.value ? 'default' : 'outline'}
								onclick={() => selectRisk(opt.value)}
								disabled={isDropping}
							>
								{opt.label}
							</Button>
						{/each}
					</div>
				</div>

				<div>
					<label for="bet-amount" class="mb-2 block text-sm font-medium">Bet Amount</label>
					<Input
						id="bet-amount"
						type="text"
						value={betAmountDisplay}
						oninput={handleBetAmountInput}
						onblur={handleBetAmountBlur}
						disabled={isDropping}
						placeholder="Enter bet amount"
					/>
					<p class="text-muted-foreground mt-1 text-xs">
						Max bet: {MAX_BET_AMOUNT.toLocaleString()}
					</p>
				</div>

				<div>
					<div class="grid grid-cols-4 gap-2">
						<Button
							size="sm"
							variant="outline"
							onclick={() =>
								setBetAmount(Math.floor(Math.min(balance || 0, MAX_BET_AMOUNT) * 0.25))}
							disabled={isDropping}>25%</Button
						>
						<Button
							size="sm"
							variant="outline"
							onclick={() => setBetAmount(Math.floor(Math.min(balance || 0, MAX_BET_AMOUNT) * 0.5))}
							disabled={isDropping}>50%</Button
						>
						<Button
							size="sm"
							variant="outline"
							onclick={() =>
								setBetAmount(Math.floor(Math.min(balance || 0, MAX_BET_AMOUNT) * 0.75))}
							disabled={isDropping}>75%</Button
						>
						<Button
							size="sm"
							variant="outline"
							onclick={() => setBetAmount(Math.floor(Math.min(balance || 0, MAX_BET_AMOUNT)))}
							disabled={isDropping}>Max</Button
						>
					</div>
				</div>

				<Button class="h-12 w-full text-lg" onclick={dropBall} disabled={!canBet}>
					{isDropping ? 'Dropping...' : 'Drop Ball'}
				</Button>
			</div>
		</div>
	</CardContent>
</Card>

<style>
	.peg {
		position: absolute;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--muted-foreground);
		opacity: 0.5;
		transform: translate(-50%, -50%);
	}

	.ball {
		position: absolute;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--primary);
		box-shadow: 0 0 8px var(--primary);
		transform: translate(-50%, -50%);
		transition: left 0.09s ease-in, top 0.09s cubic-bezier(0.55, 0, 1, 0.45);
		z-index: 10;
	}

	.buckets {
		gap: 2px;
	}
</style>
