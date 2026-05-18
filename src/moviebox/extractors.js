import { TMDB_API_KEY, TMDB_BASE_URL } from './constants.js';

export async function getMediaDetails(tmdbId, mediaType) {
    const type = mediaType === 'tv' ? 'tv' : 'movie';
    const url = `${TMDB_BASE_URL}/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    let year = null;
    if (mediaType === 'tv' && data.first_air_date) {
        year = parseInt(data.first_air_date.split('-')[0]);
    } else if (mediaType === 'movie' && data.release_date) {
        year = parseInt(data.release_date.split('-')[0]);
    }

    return {
        ...data,
        year
    };
}
