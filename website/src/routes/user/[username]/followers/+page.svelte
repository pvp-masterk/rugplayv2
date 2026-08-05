<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Avatar from '$lib/components/ui/avatar';
	import { Button } from '$lib/components/ui/button';
	import SEO from '$lib/components/self/SEO.svelte';
	import UserName from '$lib/components/self/UserName.svelte';
	import { getPublicUrl } from '$lib/utils';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { UserGroupIcon, ArrowLeft01Icon } from '@hugeicons/core-free-icons';
	import { goto } from '$app/navigation';
	import { USER_DATA } from '$lib/stores/user-data';
	import { toast } from 'svelte-sonner';
	import { haptic } from '$lib/stores/haptics';

	let { data } = $props();
	let username = $derived(data.username);
	let followers = $state(data.followers);

	$effect(() => {
		followers = data.followers;
	});

	let followLoadingIds = $state<number[]>([]);

	async function toggleFollow(target: { id: number; username: string; viewerIsFollowing: boolean }) {
		if (!$USER_DATA || followLoadingIds.includes(target.id)) return;
		followLoadingIds = [...followLoadingIds, target.id];
		try {
			const res = await fetch(`/api/user/${target.username}/follow`, {
				method: target.viewerIsFollowing ? 'DELETE' : 'POST'
			});
			if (res.ok) {
				followers = followers.map((f: any) =>
					f.id === target.id ? { ...f, viewerIsFollowing: !target.viewerIsFollowing } : f
				);
				haptic.trigger(target.viewerIsFollowing ? 'light' : 'success');
				toast.success(target.viewerIsFollowing ? 'Unfollowed' : 'Following');
			} else {
				const errData = await res.json();
				toast.error(errData.message || 'Failed to update follow status');
			}
		} catch {
			toast.error('Failed to update follow status');
		} finally {
			followLoadingIds = followLoadingIds.filter((id) => id !== target.id);
		}
	}
</script>

<SEO
	title={`People following @${username} - Rugplay`}
	description={`See who follows @${username} on Rugplay.`}
/>

<div class="container mx-auto max-w-2xl p-6">
	<div class="mb-4 flex items-center gap-2">
		<Button variant="ghost" size="icon" onclick={() => goto(`/user/${username}`)}>
			<HugeiconsIcon icon={ArrowLeft01Icon} class="h-4 w-4" />
		</Button>
		<h1 class="text-xl font-bold">Followers of @{username}</h1>
	</div>

	<Card.Root>
		<Card.Content class="space-y-2">
			{#if followers.length === 0}
				<div class="py-12 text-center">
					<div class="bg-muted mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
						<HugeiconsIcon icon={UserGroupIcon} class="text-muted-foreground h-8 w-8" />
					</div>
					<h3 class="mb-2 text-lg font-semibold">No followers yet</h3>
					<p class="text-muted-foreground">Nobody is following @{username} yet.</p>
				</div>
			{:else}
				{#each followers as follower (follower.id)}
					<div class="flex items-center justify-between rounded-lg border p-3">
						<a
							href="/user/{follower.username}"
							class="flex min-w-0 items-center gap-3 hover:opacity-80"
						>
							<Avatar.Root class="h-10 w-10 shrink-0">
								<Avatar.Image src={getPublicUrl(follower.image)} alt={follower.name} />
								<Avatar.Fallback class="text-sm">{follower.name?.charAt(0) || '?'}</Avatar.Fallback>
							</Avatar.Root>
							<div class="min-w-0">
								<div class="truncate text-sm font-medium">
									<UserName name={follower.name} nameColor={follower.nameColor} />
								</div>
								<p class="text-muted-foreground truncate text-xs">@{follower.username}</p>
							</div>
						</a>
						{#if $USER_DATA && Number($USER_DATA.id) !== follower.id}
							<Button
								variant={follower.viewerIsFollowing ? 'outline' : 'default'}
								size="sm"
								onclick={() => toggleFollow(follower)}
								disabled={followLoadingIds.includes(follower.id)}
							>
								{follower.viewerIsFollowing ? 'Following' : 'Follow'}
							</Button>
						{/if}
					</div>
				{/each}
			{/if}
		</Card.Content>
	</Card.Root>
</div>
