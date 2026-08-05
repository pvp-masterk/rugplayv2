import { error } from '@sveltejs/kit';

export async function load({ params, fetch }) {
    const { username } = params;

    try {
        const response = await fetch(`/api/user/${username}/following`);

        if (!response.ok) {
            if (response.status === 404) {
                throw error(404, 'User not found');
            }
            throw error(500, 'Failed to load following');
        }

        const data = await response.json();

        return {
            username,
            following: data.following || []
        };
    } catch (e) {
        console.error('Failed to fetch following:', e);
        throw error(500, 'Failed to load following');
    }
}
