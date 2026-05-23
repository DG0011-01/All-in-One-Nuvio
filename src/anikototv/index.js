const PROVIDER_NAME = "AnikotoTV";
const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";

async function getTMDBTitle(tmdbId, mediaType) {
    const type = (mediaType === 'tv' || mediaType === 'series') ? 'tv' : 'movie';
    let url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    
    if (String(tmdbId).startsWith("tt")) {
        url = `https://api.themoviedb.org/3/find/${tmdbId}?external_source=imdb_id&api_key=${TMDB_API_KEY}`;
        try {
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (type === 'tv' && data.tv_results && data.tv_results.length > 0) {
                    return { title: data.tv_results[0].name, numericId: data.tv_results[0].id };
                } else if (type === 'movie' && data.movie_results && data.movie_results.length > 0) {
                    return { title: data.movie_results[0].title, numericId: data.movie_results[0].id };
                }
            }
        } catch (e) { }
        return { title: null, numericId: null };
    }

    try {
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            return { title: type === 'tv' ? data.name : data.title, numericId: tmdbId };
        }
    } catch (e) { }
    return { title: null, numericId: null };
}

async function getTMDBSeasonName(tmdbId, season) {
    const url = `https://api.themoviedb.org/3/tv/${tmdbId}/season/${season}?api_key=${TMDB_API_KEY}`;
    try {
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            return data.name;
        }
    } catch (e) { }
    return null;
}

async function aniListBridge(title) {
    const query = `
    query ($search: String) {
      Media (search: $search, type: ANIME) {
        id
        idMal
      }
    }
    `;
    try {
        const res = await fetch("https://graphql.anilist.co", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            body: JSON.stringify({ query: query, variables: { search: title } })
        });
        const data = await res.json();
        if (data && data.data && data.data.Media) {
            return {
                malId: data.data.Media.idMal,
                aniId: data.data.Media.id,
                absEp: null
            };
        }
    } catch (e) { }
    return null;
}

async function getMalId(tmdbId, mediaType, season, episode) {
    // Try Haglund API for mapping
    try {
        let url = `https://arm.haglund.dev/api/v2/tmdb?id=${tmdbId}`;
        if (mediaType === 'tv' || mediaType === 'series') url += `&s=${season}&e=${episode}`;
        
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            if (data.mal || data.mal_id || data.anilist || data.ani_id) {
                return {
                    malId: data.mal || data.mal_id,
                    aniId: data.anilist || data.ani_id,
                    absEp: data.episode || episode
                };
            }
        }
    } catch (e) { }

    // Fallback to AniList GraphQL Bridge
    const tmdbData = await getTMDBTitle(tmdbId, mediaType);
    let searchTitle = tmdbData.title;
    const numericTmdbId = tmdbData.numericId;

    if (searchTitle) {
        if ((mediaType === 'tv' || mediaType === 'series') && season > 1 && numericTmdbId) {
            const seasonName = await getTMDBSeasonName(numericTmdbId, season);
            if (seasonName) {
                if (seasonName.toLowerCase().includes(searchTitle.toLowerCase())) {
                    searchTitle = seasonName;
                } else {
                    searchTitle = `${searchTitle} ${seasonName}`;
                }
            } else {
                searchTitle = `${searchTitle} Season ${season}`;
            }
        }
        console.log(`[${PROVIDER_NAME}] TMDB Title: ${searchTitle}`);
        const mapping = await aniListBridge(searchTitle);
        if (mapping) {
            mapping.absEp = episode;
            return mapping;
        }
    }
    
    return null;
}

async function extractHLS(embedUrl, domain) {
    try {
        const res = await fetch(embedUrl, { headers: { "Referer": `https://${domain}/` } });
        if (!res.ok) return null;
        const html = await res.text();
        const match = html.match(/data-id="(\d+)"/);
        if (!match) return null;
        
        const dataId = match[1];
        const sourceUrl = `https://${domain}/stream/getSources?id=${dataId}`;
        const sourceRes = await fetch(sourceUrl, {
            headers: {
                "X-Requested-With": "XMLHttpRequest",
                "Referer": embedUrl
            }
        });
        
        if (!sourceRes.ok) return null;
        const json = await sourceRes.json();
        
        if (json.sources && json.sources.file) {
            const subtitles = [];
            if (json.tracks) {
                for (const track of json.tracks) {
                    if (track.kind === "captions" || track.kind === "subtitles") {
                        subtitles.push({
                            url: track.file,
                            lang: track.label || "Unknown"
                        });
                    }
                }
            }
            return {
                url: json.sources.file,
                subtitles: subtitles,
                headers: {
                    "Referer": `https://${domain}/`,
                    "Origin": `https://${domain}`
                }
            };
        }
    } catch (e) {
        console.error(`[${PROVIDER_NAME}] Extractor Error for ${domain}:`, e.message);
    }
    return null;
}

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        console.log(`[${PROVIDER_NAME}] Fetching: ${tmdbId} S${season} E${episode}`);
        
        const mapping = await getMalId(tmdbId, mediaType, season, episode);
        if (!mapping || (!mapping.malId && !mapping.aniId)) {
            console.log(`[${PROVIDER_NAME}] Exhausted all mapping bridges. Could not resolve ID.`);
            return [];
        }
        
        const isMal = !!mapping.malId;
        const targetId = isMal ? mapping.malId : mapping.aniId;
        const idType = isMal ? 'mal' : 'ani';
        const epNum = mediaType === 'movie' ? 1 : (mapping.absEp || episode);
        
        console.log(`[${PROVIDER_NAME}] Mapped to ${idType.toUpperCase()} ID: ${targetId} | Ep: ${epNum}`);
        
        const streams = [];
        
        const sStr = String(season).padStart(2, '0');
        const eStr = String(episode).padStart(2, '0');
        const epFormat = mediaType === 'movie' ? '' : ` S${sStr}E${eStr}`;

        const domains = [
            { id: "Vidstream", domain: "megaplay.buzz" }
        ];

        for (const srv of domains) {
            const subUrl = `https://${srv.domain}/stream/${idType}/${targetId}/${epNum}/sub`;
            const subData = await extractHLS(subUrl, srv.domain);
            if (subData) {
                streams.push({
                    name: `${PROVIDER_NAME}`,
                    quality: "1080p",
                    title: `${srv.id}${epFormat} (SUB)`,
                    url: subData.url,
                    subtitles: subData.subtitles,
                    headers: subData.headers
                });
            }

            const dubUrl = `https://${srv.domain}/stream/${idType}/${targetId}/${epNum}/dub`;
            const dubData = await extractHLS(dubUrl, srv.domain);
            if (dubData) {
                streams.push({
                    name: `${PROVIDER_NAME}`,
                    quality: "1080p",
                    title: `${srv.id}${epFormat} (DUB)`,
                    url: dubData.url,
                    subtitles: dubData.subtitles,
                    headers: dubData.headers
                });
            }
        }
        
        console.log(`[${PROVIDER_NAME}] Returning ${streams.length} direct stream URLs.`);
        return streams;
        
    } catch (e) {
        console.error(`[${PROVIDER_NAME}] Fatal Error:`, e);
        return [];
    }
}

async function search(args) { return []; }
async function getCatalog(args) { return []; }
async function getItemDetails(args) { return []; }

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams, search, getCatalog, getItemDetails };
} else {
    global.getStreams = getStreams;
}
