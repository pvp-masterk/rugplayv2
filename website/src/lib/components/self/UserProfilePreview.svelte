<script lang="ts">
	import * as Avatar from '$lib/components/ui/avatar';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Button } from '$lib/components/ui/button';
	import ProfileBadges from './ProfileBadges.svelte';
	import { getPublicUrl, formatValue } from '$lib/utils';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { Calendar01Icon, Wallet01Icon, UserGroupIcon, UserAdd01Icon, UserCheck01Icon } from '@hugeicons/core-free-icons';
	import type { UserProfileData } from '$lib/types/user-profile';
	import { USER_DATA } from '$lib/stores/user-data';
	import { toast } from 'svelte-sonner';
	import { haptic } from '$lib/stores/haptics';

	let { userId, showBio = true }: { userId: number, showBio?: boolean } = $props();

	let userData = $state<UserProfileData | null>(null);
	let loading = $state(true);
	let error = $state(false);

	let isFollowing = $state(false);
	let followLoading = $state(false);
	let isOwnPreview = $derived($USER_DATA && Number($USER_DATA.id) === userId);

	async function toggleFollow(e: MouseEvent) {
		e.stopPropagation();
		if (!$USER_DATA || isOwnPreview || followLoading || !userData?.profile?.username) return;
		followLoading = true;
		try {
			const res = await fetch(`/api/user/${userData.profile.username}/follow`, {
				method: isFollowing ? 'DELETE' : 'POST'
			});
			if (res.ok) {
				isFollowing = !isFollowing;
				haptic.trigger(isFollowing ? 'success' : 'light');
				toast.success(isFollowing ? 'Following' : 'Unfollowed');
			} else {
				const data = await res.json();
				toast.error(data.message || 'Failed to update follow status');
			}
		} catch {
			toast.error('Failed to update follow status');
		} finally {
			followLoading = false;
		}
	}

	async function fetchUserData() {
		loading = true;
		error = false;

		try {
			const response = await fetch(`/api/user/${userId}`);
			if (response.ok) {
				userData = await response.json();
				isFollowing = userData?.profile?.viewerIsFollowing ?? false;
			} else {
				error = true;
			}
		} catch (e) {
			console.error('Failed to fetch user data:', e);
			error = true;
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (userId) {
			const abortController = new AbortController();
			fetchUserData();

			return () => {
				abortController.abort();
			};
		}
	});

	let profile = $derived(userData?.profile);
	let stats = $derived(userData?.stats);
</script>

<div class="p-4">
	{#if loading}
		<div class="flex gap-4">
			<Skeleton class="size-14 shrink-0 rounded-full" />
			<div class="min-w-0 flex-1 space-y-2">
				<div class="flex items-center space-x-2">
					<Skeleton class="h-5 w-[150px]" />
					<Skeleton class="h-5 w-[80px]" />
				</div>
				<Skeleton class="h-4 w-[130px]" />
				<Skeleton class="h-4 w-[200px]" />
				<Skeleton class="h-4 w-[200px]" />
				<Skeleton class="h-4 w-[200px]" />
				<Skeleton class="h-4 w-[200px]" />
				<div class="space-y-1 pt-2">
					<div class="flex items-center justify-between">
						<Skeleton class="h-4 w-[80px]" />
						<Skeleton class="h-4 w-[100px]" />
					</div>
					<div class="flex items-center justify-between">
						<Skeleton class="h-4 w-[50px]" />
						<Skeleton class="h-4 w-[90px]" />
					</div>
				</div>
				<Skeleton class="h-4 w-[180px]" />
			</div>
		</div>
	{:else if error}
		<div class="flex items-center justify-center py-8">
			<span class="text-muted-foreground text-sm">Failed to load profile</span>
		</div>
	{:else if profile}
		<div class="flex gap-4">
			<Avatar.Root class="h-14 w-14 shrink-0">
				<Avatar.Image src={getPublicUrl(profile.image)} alt={profile.name} />
				<Avatar.Fallback class="text-sm">{profile.name?.charAt(0) || '?'}</Avatar.Fallback>
			</Avatar.Root>
			<div class="min-w-0 flex-1 space-y-1">
				<div class="flex min-w-0 items-center gap-2">
					<h4 class="max-w-[150px] truncate text-sm font-semibold sm:max-w-[200px]">
						{profile.name}
					</h4>
					<ProfileBadges user={profile} showId={true} size="sm" />
				</div>
				<p class="text-muted-foreground text-sm">@{profile.username}</p>

				{#if profile.bio && showBio}
					<p class="text-sm">{profile.bio}</p>
				{/if}

				{#if stats}
					<div class="flex items-center gap-3 pt-1">
						<span class="text-muted-foreground flex items-center gap-1 text-xs">
							<HugeiconsIcon icon={UserGroupIcon} class="h-3 w-3" />
							<span class="text-foreground font-medium">{stats.followerCount}</span> followers
						</span>
						<span class="text-muted-foreground text-xs">
							<span class="text-foreground font-medium">{stats.followingCount}</span> following
						</span>
						{#if $USER_DATA && !isOwnPreview}
							<Button
								variant={isFollowing ? 'outline' : 'default'}
								size="icon"
								class="ml-auto h-6 w-6"
								onclick={toggleFollow}
								disabled={followLoading}
								title={isFollowing ? 'Unfollow' : 'Follow'}
							>
								<HugeiconsIcon icon={isFollowing ? UserCheck01Icon : UserAdd01Icon} class="h-3 w-3" />
							</Button>
						{/if}
					</div>

					<div class="space-y-1 pt-2">
						<div class="flex items-center justify-between">
							<span class="text-muted-foreground flex items-center gap-1 text-xs">
								<HugeiconsIcon icon={Wallet01Icon} class="h-3 w-3" />
								Portfolio
							</span>
							<span class="font-mono text-sm font-medium">
								{formatValue(stats.totalPortfolioValue)}
							</span>
						</div>

						<div class="flex items-center justify-between">
							<span class="text-muted-foreground flex items-center gap-1 text-xs">
								<HugeiconsIcon icon={Wallet01Icon} class="h-3 w-3" />
								Cash
							</span>
							<span class="text-success font-mono text-sm font-medium">
								{formatValue(stats.baseCurrencyBalance)}
							</span>
						</div>
					</div>
				{/if}

				<div class="flex items-center pt-2">
					<HugeiconsIcon icon={Calendar01Icon} class="mr-2 h-4 w-4 opacity-70" />
					<span class="text-muted-foreground text-xs">
						Joined {new Date(profile.createdAt).toLocaleDateString('en-US', {
							year: 'numeric',
							month: 'long'
						})}
					</span>
				</div>
			</div>
		</div>
	{/if}
</div>
