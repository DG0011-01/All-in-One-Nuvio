import { CONFIG_URL, FALLBACK_NF_API, TMDB_API_KEY, TMDB_BASE_URL } from './constants.js';

export async function getNfMirrorApi() {
    try {
        const resp = await fetch(CONFIG_URL);
        const data = await resp.json();
        return data.nfmirror || FALLBACK_NF_API;
    } catch (e) {
        console.warn('[NetMirror] Using fallback API URL:', FALLBACK_NF_API);
        return FALLBACK_NF_API;
    }
}

export async function getMediaDetails(tmdbId, mediaType) {
    const type = mediaType === 'tv' ? 'tv' : 'movie';
    const url = `${TMDB_BASE_URL}/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const response = await fetch(url);
    return response.json();
}
