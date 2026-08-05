import { error } from '@sveltejs/kit';

export async function load({ params, fetch }) {
    const { username } = params;

    try {
        const response = await fetch(`/api/user/${username}/followers`);

        if (!response.ok) {
            if (response.status === 404) {
                throw error(404, 'User not found');
            }
            throw error(500, 'Failed to load followers');
        }

        const data = await response.json();

        return {
            username,
            followers: data.followers || []
        };
    } catch (e) {
        console.error('Failed to fetch followers:', e);
        throw error(500, 'Failed to load followers');
    }
}
