import { MOVIEBOX_API, BASE_HEADERS } from './constants.js';
import { getMediaDetails } from './extractors.js';

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function unwrapData(json) {
    if (!json) return {};
    const data = json.data || json;
    return data.data || data;
}

async function fetchWithHeaders(url, options = {}) {
    const headers = Object.assign({}, BASE_HEADERS, options.headers || {});
    const fetchOptions = Object.assign({}, options, { headers });
    
    console.log(`[MovieBox] Fetching: ${url}`);
    try {
        const response = await fetch(url, fetchOptions);
        console.log(`[MovieBox] Status: ${response.status}`);
        if (!response.ok) {
            const text = await response.text();
            console.log(`[MovieBox] Error response: ${text.substring(0, 200)}`);
        }
        return response;
    } catch (err) {
        console.log(`[MovieBox] Fetch error: ${err.message}`);
        throw err;
    }
}

async function getStreams(tmdbId, mediaType, season, episode) {
    console.log(`[MovieBox] Fetching streams for ${mediaType} ${tmdbId}`);
    try {
        const mediaData = await getMediaDetails(tmdbId, mediaType);
        const title = mediaType === 'movie' ? mediaData.title : mediaData.name;

        if (!title) {
            console.log(`[MovieBox] Could not fetch title`);
            return [];
        }

        console.log(`[MovieBox] Searching for: ${title}`);

        const streams = await fetchMovieboxStreams(title, mediaType, season, episode);

        if (!streams || streams.length === 0) {
            console.log(`[MovieBox] No streams found for ${title}`);
            return [];
        }

        console.log(`[MovieBox] Found ${streams.length} streams for ${title}`);
        return streams;
    } catch (error) {
        console.error(`[MovieBox] Error: ${error.message}`);
        return [];
    }
}

async function fetchMovieboxStreams(title, mediaType, season, episode) {
    const streams = [];
    
    try {
        await fetchWithHeaders(`${MOVIEBOX_API}/wefeed-h5-bff/app/get-latest-app-pkgs?app_name=moviebox`).catch(() => {});

        const subjectType = season != null ? 2 : 1;
        
        const searchResp = await fetchWithHeaders(`${MOVIEBOX_API}/wefeed-h5-bff/web/subject/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                keyword: title,
                page: 1,
                perPage: 24,
                subjectType: subjectType
            })
        });
        
        const searchJson = await searchResp.json();
        const searchData = unwrapData(searchJson);
        
        console.log(`[MovieBox] Search raw: ${JSON.stringify(searchJson).substring(0, 500)}`);
        
        const items = searchData.items || [];
        console.log(`[MovieBox] Found ${items.length} items`);
        items.forEach(i => console.log(`  - ${i.title} (${i.subjectId})`));
        if (items.length === 0) return [];
        
        const SEASON_SUFFIX_REGEX = /\sS\d+(?:-S?\d+)*$/i;
        const escapedTitle = escapeRegExp(title);
        const titleMatchRegex = new RegExp(`^${escapedTitle}(?: \\[([^\\]]+)\\])?$`, 'i');
        
        const uniqueIdsWithLang = [];
        const seenIds = new Set();

        for (const item of items) {
            const id = item.subjectId;
            if (!id || seenIds.has(id)) continue;
            
            const rawItemTitle = item.title || "";
            const cleanTitle = rawItemTitle.replace(SEASON_SUFFIX_REGEX, "");
            
            console.log(`[MovieBox] Checking: "${rawItemTitle}" -> "${cleanTitle}"`);
            
            const match = cleanTitle.match(titleMatchRegex);
            if (!match) {
                console.log(`[MovieBox] No match for: ${cleanTitle}`);
                continue;
            }
            
            const language = match[1] || "Original";
            console.log(`[MovieBox] MATCHED: ${id} - "${language}"`);
            seenIds.add(id);
            uniqueIdsWithLang.push({ id, language });
        }

        uniqueIdsWithLang.sort((a, b) => {
            if (a.language === "Original") return -1;
            if (b.language === "Original") return 1;
            return 0;
        });

        if (uniqueIdsWithLang.length === 0) return [];

        for (const { id: subjectId, language } of uniqueIdsWithLang) {
            try {
                const detailResp = await fetchWithHeaders(`${MOVIEBOX_API}/wefeed-h5-bff/web/subject/detail?subjectId=${subjectId}`);
                const detailJson = await detailResp.json();
                const detailData = unwrapData(detailJson);
                
                const subject = detailData.subject || {};
                const detailPath = subject.detailPath || "";
                
                let params = `subjectId=${subjectId}`;
                if (season != null) {
                    params += `&se=${season}&ep=${episode}`;
                }
                
                const downloadHeaders = {
                    "Referer": `https://fmoviesunblocked.net/spa/videoPlayPage/movies/${detailPath}?id=${subjectId}&type=/movie/detail`,
                    "Origin": "https://fmoviesunblocked.net"
                };
                
                const sourceResp = await fetchWithHeaders(`${MOVIEBOX_API}/wefeed-h5-bff/web/subject/download?${params}`, {
                    headers: downloadHeaders
                });
                
                const sourceJson = await sourceResp.json();
                const sourceData = unwrapData(sourceJson);
                
                const downloads = sourceData.downloads || [];
                
                downloads.forEach(d => {
                    const dlink = d.url;
                    if (dlink) {
                        const res = d.resolution || 720;
                        const qualityStr = `${res}p`;
                        const nameParts = ["MovieBox", language].filter(p => p && p.trim() !== "");

                        streams.push({
                            name: nameParts.join(" • "),
                            title: qualityStr,
                            url: dlink,
                            quality: qualityStr,
                            type: dlink.includes(".m3u8") ? "m3u8" : dlink.includes(".mp4") || dlink.includes(".mkv") ? "video" : null,
                            headers: {
                                "Referer": "https://fmoviesunblocked.net/",
                                "Origin": "https://fmoviesunblocked.net"
                            },
                            provider: "moviebox"
                        });
                    }
                });
            } catch (e) {
                console.error(`[MovieBox] Error processing subject ${subjectId}:`, e);
            }
        }

    } catch (err) {
        console.error(`[MovieBox] fetchMovieboxStreams failed:`, err);
    }
    
    return streams;
}

module.exports = { getStreams };
