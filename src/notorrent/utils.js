import { TMDB_API_KEY } from './constants.js';

export async function getImdbId(tmdbId, mediaType) {
    try {
        const type = mediaType === 'tv' ? 'tv' : 'movie';
        const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        return data.external_ids?.imdb_id || null;
    } catch (e) {
        console.error(`[NoTorrent] Failed obtaining IMDB mapping:`, e.message);
        return null;
    }
}

export function cleanText(str) {
    if (!str) return "";
    return str.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]/gu, '').trim();
}

export function extractQuality(titleText) {
    const raw = titleText || "";
    const match = raw.match(/(\d{3,4}p)/);
    if (match) return match[0];
    if (raw.toUpperCase().includes("FREE")) return "Auto";
    return "Unknown";
}
