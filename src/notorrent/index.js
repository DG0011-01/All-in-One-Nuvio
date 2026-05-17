import { NOTORRENT_API } from './constants.js';
import { getImdbId, cleanText, extractQuality } from './utils.js';

async function getStreams(tmdbId, mediaType, season, episode) {
    console.log(`[NoTorrent] Searching for ${mediaType} ${tmdbId}`);
    const streams = [];

    try {
        const imdbId = await getImdbId(tmdbId, mediaType);
        if (!imdbId) {
            console.warn(`[NoTorrent] Failed to map IMDB ID.`);
            return [];
        }
        
        let apiUrl = `${NOTORRENT_API}/stream/movie/${imdbId}.json`;
        if (mediaType === 'tv' || season != null) {
            apiUrl = `${NOTORRENT_API}/stream/series/${imdbId}:${season}:${episode}.json`;
        }

        const response = await fetch(apiUrl);
        if (!response.ok) {
            console.warn(`[NoTorrent] API down or unreachable.`);
            return [];
        }

        const data = await response.json();
        const rawList = data.streams || [];

        rawList.forEach(item => {
            if (item.externalUrl || !item.url) return;
            
            if (item.url.includes("github.com") || item.url.includes("googleusercontent")) return;

            const rawTitle = item.title || "";
            const cleanTitleString = cleanText(rawTitle);
            
            const quality = extractQuality(cleanTitleString);
            
            let language = "Default";
            const langMatch = cleanTitleString.match(/\(([^)]+)\)/);
            if (langMatch) {
                language = langMatch[1].charAt(0).toUpperCase() + langMatch[1].slice(1).toLowerCase();
            }

            const proxyHeaders = item.behaviorHints?.proxyHeaders?.request || {};
            const headers = Object.assign({}, item.behaviorHints?.headers || {}, proxyHeaders);

            const nameParts = ["NoTorrent", language !== "Default" ? language : ""].filter(p => p && p.trim() !== "");

            streams.push({
                name: nameParts.join(" • "),
                title: quality,
                url: item.url,
                quality: quality,
                type: item.url.includes(".m3u8") ? "m3u8" : item.url.includes(".mp4") || item.url.includes(".mkv") ? "video" : null,
                headers: Object.keys(headers).length > 0 ? headers : undefined,
                provider: "notorrent"
            });
        });

    } catch (e) {
        console.error(`[NoTorrent] Fetch failed:`, e.message);
    }

    console.log(`[NoTorrent] Total results found: ${streams.length}`);
    return streams;
}

module.exports = { getStreams };
