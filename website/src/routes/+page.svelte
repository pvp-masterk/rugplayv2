<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Avatar from '$lib/components/ui/avatar';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import SEO from '$lib/components/self/SEO.svelte';
	import UserName from '$lib/components/self/UserName.svelte';
	import SendMoneyModal from '$lib/components/self/SendMoneyModal.svelte';
	import { getPublicUrl, formatDate } from '$lib/utils';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		UserGroupIcon,
		SentIcon,
		Cancel01Icon,
		Tick01Icon,
		Loading03Icon
	} from '@hugeicons/core-free-icons';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { USER_DATA } from '$lib/stores/user-data';
	import { toast } from 'svelte-sonner';
	import { haptic } from '$lib/stores/haptics';
	import { PENDING_REQUEST_COUNT } from '$lib/stores/friend-requests';

	type FriendRow = {
		id: number;
		username: string;
		name: string;
		image: string | null;
		nameColor: string | null;
		friendedAt: string;
	};

	type RequestRow = {
		id: number;
		createdAt: string;
		user: { id: number; username: string; name: string; image: string | null; nameColor: string | null };
	};

	let loading = $state(true);
	let friends = $state<FriendRow[]>([]);
	let incoming = $state<RequestRow[]>([]);
	let outgoing = $state<RequestRow[]>([]);

	let activeTab = $state<'friends' | 'requests'>('friends');
	let requestActionLoadingIds = $state<number[]>([]);

	let sendMoneyModalOpen = $state(false);
	let sendMoneyTarget = $state('');

	const tabs = [
		{ value: 'friends', label: 'Friends' },
		{ value: 'requests', label: 'Requests' }
	];

	async function loadFriends() {
		if (!$USER_DATA) return;
		try {
			const res = await fetch(`/api/user/${$USER_DATA.username}/friends`);
			if (res.ok) {
				const data = await res.json();
				friends = data.friends || [];
			} else {
				toast.error('Failed to load friends');
			}
		} catch {
			toast.error('Failed to load friends');
		}
	}

	async function loadRequests() {
		try {
			const res = await fetch('/api/friend-requests');
			if (res.ok) {
				const data = await res.json();
				incoming = data.incoming || [];
				outgoing = data.outgoing || [];
				PENDING_REQUEST_COUNT.set(data.pendingRequestCount ?? incoming.length);
			} else {
				toast.error('Failed to load friend requests');
			}
		} catch {
			toast.error('Failed to load friend requests');
		}
	}

	onMount(async () => {
		if (!$USER_DATA) {
			goto('/');
			return;
		}
		loading = true;
		await Promise.all([loadFriends(), loadRequests()]);
		loading = false;
	});

	async function acceptRequest(request: RequestRow) {
		if (requestActionLoadingIds.includes(request.id)) return;
		requestActionLoadingIds = [...requestActionLoadingIds, request.id];
		try {
			const res = await fetch(`/api/friend-requests/${request.id}/accept`, { method: 'POST' });
			if (res.ok) {
				incoming = incoming.filter((r) => r.id !== request.id);
				PENDING_REQUEST_COUNT.set(incoming.length);
				haptic.trigger('success');
				toast.success(`You're now friends with @${request.user.username}!`);
				loadFriends();
			} else {
				const data = await res.json();
				toast.error(data.message || 'Failed to accept friend request');
			}
		} catch {
			toast.error('Failed to accept friend request');
		} finally {
			requestActionLoadingIds = requestActionLoadingIds.filter((id) => id !== request.id);
		}
	}

	async function declineRequest(request: RequestRow) {
		if (requestActionLoadingIds.includes(request.id)) return;
		requestActionLoadingIds = [...requestActionLoadingIds, request.id];
		try {
			const res = await fetch(`/api/friend-requests/${request.id}/decline`, { method: 'POST' });
			if (res.ok) {
				incoming = incoming.filter((r) => r.id !== request.id);
				PENDING_REQUEST_COUNT.set(incoming.length);
				haptic.trigger('light');
				toast.success('Friend request declined');
			} else {
				const data = await res.json();
				toast.error(data.message || 'Failed to decline friend request');
			}
		} catch {
			toast.error('Failed to decline friend request');
		} finally {
			requestActionLoadingIds = requestActionLoadingIds.filter((id) => id !== request.id);
		}
	}

	async function cancelRequest(request: RequestRow) {
		if (requestActionLoadingIds.includes(request.id)) return;
		requestActionLoadingIds = [...requestActionLoadingIds, request.id];
		try {
			const res = await fetch(`/api/friend-requests/${request.id}`, { method: 'DELETE' });
			if (res.ok) {
				outgoing = outgoing.filter((r) => r.id !== request.id);
				haptic.trigger('light');
				toast.success('Friend request cancelled');
			} else {
				const data = await res.json();
				toast.error(data.message || 'Failed to cancel friend request');
			}
		} catch {
			toast.error('Failed to cancel friend request');
		} finally {
			requestActionLoadingIds = requestActionLoadingIds.filter((id) => id !== request.id);
		}
	}

	function openSendMoney(username: string) {
		sendMoneyTarget = username;
		sendMoneyModalOpen = true;
	}
</script>

<SEO title="Friends - Rugplay" description="Manage your friends and friend requests on Rugplay." />

<SendMoneyModal bind:open={sendMoneyModalOpen} prefilledUsername={sendMoneyTarget} />

<div class="container mx-auto max-w-2xl p-6">
	<header class="mb-6 text-center">
		<h1 class="mb-2 text-3xl font-bold">Friends</h1>
		<p class="text-muted-foreground">Manage your friends and pending requests</p>
	</header>

	<div class="mb-6 flex items-center justify-center">
		<div class="bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]">
			<div class="grid w-full max-w-xs grid-cols-2">
				{#each tabs as tab}
					<button
						onclick={() => { haptic.trigger('selection'); activeTab = tab.value as 'friends' | 'requests'; }}
						class="data-[state=active]:bg-background data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring text-foreground inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-2 py-1 text-sm font-medium transition-[color,box-shadow] focus-visible:outline-1 focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm"
						data-state={activeTab === tab.value ? 'active' : 'inactive'}
					>
						{tab.label}
						{#if tab.value === 'requests' && $PENDING_REQUEST_COUNT > 0}
							<Badge variant="default" class="ml-1 px-1.5 py-0 text-xs">{$PENDING_REQUEST_COUNT}</Badge>
						{/if}
					</button>
				{/each}
			</div>
		</div>
	</div>

	{#if loading}
		<div class="py-12 text-center">
			<HugeiconsIcon icon={Loading03Icon} class="text-muted-foreground mx-auto h-6 w-6 animate-spin" />
		</div>
	{:else if activeTab === 'friends'}
		<Card.Root>
			<Card.Content class="space-y-2">
				{#if friends.length === 0}
					<div class="py-12 text-center">
						<div class="bg-muted mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
							<HugeiconsIcon icon={UserGroupIcon} class="text-muted-foreground h-8 w-8" />
						</div>
						<h3 class="mb-2 text-lg font-semibold">No friends yet</h3>
						<p class="text-muted-foreground">Add friends from their profile page.</p>
					</div>
				{:else}
					{#each friends as friend (friend.id)}
						<div class="flex items-center justify-between rounded-lg border p-3">
							<a
								href="/user/{friend.username}"
								class="flex min-w-0 items-center gap-3 hover:opacity-80"
							>
								<Avatar.Root class="h-10 w-10 shrink-0">
									<Avatar.Image src={getPublicUrl(friend.image)} alt={friend.name} />
									<Avatar.Fallback class="text-sm">{friend.name?.charAt(0) || '?'}</Avatar.Fallback>
								</Avatar.Root>
								<div class="min-w-0">
									<div class="truncate text-sm font-medium">
										<UserName name={friend.name} nameColor={friend.nameColor} />
									</div>
									<p class="text-muted-foreground truncate text-xs">@{friend.username}</p>
								</div>
							</a>
							<Button variant="outline" size="sm" onclick={() => openSendMoney(friend.username)}>
								<HugeiconsIcon icon={SentIcon} class="h-4 w-4" />
								Send
							</Button>
						</div>
					{/each}
				{/if}
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="space-y-6">
			<Card.Root>
				<Card.Header>
					<Card.Title class="text-base">Incoming requests</Card.Title>
					<Card.Description>People who want to be friends with you</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-2">
					{#if incoming.length === 0}
						<p class="text-muted-foreground text-sm">No incoming requests.</p>
					{:else}
						{#each incoming as request (request.id)}
							<div class="flex items-center justify-between rounded-lg border p-3">
								<a
									href="/user/{request.user.username}"
									class="flex min-w-0 items-center gap-3 hover:opacity-80"
								>
									<Avatar.Root class="h-10 w-10 shrink-0">
										<Avatar.Image src={getPublicUrl(request.user.image)} alt={request.user.name} />
										<Avatar.Fallback class="text-sm">{request.user.name?.charAt(0) || '?'}</Avatar.Fallback>
									</Avatar.Root>
									<div class="min-w-0">
										<div class="truncate text-sm font-medium">
											<UserName name={request.user.name} nameColor={request.user.nameColor} />
										</div>
										<p class="text-muted-foreground truncate text-xs">@{request.user.username}</p>
									</div>
								</a>
								<div class="flex items-center gap-2">
									<Button
										variant="default"
										size="sm"
										onclick={() => acceptRequest(request)}
										disabled={requestActionLoadingIds.includes(request.id)}
									>
										<HugeiconsIcon icon={Tick01Icon} class="h-4 w-4" />
										Accept
									</Button>
									<Button
										variant="outline"
										size="sm"
										onclick={() => declineRequest(request)}
										disabled={requestActionLoadingIds.includes(request.id)}
									>
										Decline
									</Button>
								</div>
							</div>
						{/each}
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title class="text-base">Outgoing requests</Card.Title>
					<Card.Description>Requests you've sent that are still pending</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-2">
					{#if outgoing.length === 0}
						<p class="text-muted-foreground text-sm">No outgoing requests.</p>
					{:else}
						{#each outgoing as request (request.id)}
							<div class="flex items-center justify-between rounded-lg border p-3">
								<a
									href="/user/{request.user.username}"
									class="flex min-w-0 items-center gap-3 hover:opacity-80"
								>
									<Avatar.Root class="h-10 w-10 shrink-0">
										<Avatar.Image src={getPublicUrl(request.user.image)} alt={request.user.name} />
										<Avatar.Fallback class="text-sm">{request.user.name?.charAt(0) || '?'}</Avatar.Fallback>
									</Avatar.Root>
									<div class="min-w-0">
										<div class="truncate text-sm font-medium">
											<UserName name={request.user.name} nameColor={request.user.nameColor} />
										</div>
										<p class="text-muted-foreground truncate text-xs">@{request.user.username}</p>
									</div>
								</a>
								<Button
									variant="outline"
									size="sm"
									onclick={() => cancelRequest(request)}
									disabled={requestActionLoadingIds.includes(request.id)}
								>
									<HugeiconsIcon icon={Cancel01Icon} class="h-4 w-4" />
									Cancel
								</Button>
							</div>
						{/each}
					{/if}
				</Card.Content>
			</Card.Root>
		</div>
	{/if}
</div>
