import { XPASS_API, BASE_HEADERS } from './constants.js';
import { generateM3u8 } from './utils.js';

async function getStreams(tmdbId, mediaType, season, episode) {
    console.log(`[Xpass] Fetching streams for ${mediaType} ${tmdbId}`);
    const streams = [];

    try {
        const embedUrl = mediaType === 'tv' 
            ? `${XPASS_API}/e/tv/${tmdbId}/${season}/${episode}`
            : `${XPASS_API}/e/movie/${tmdbId}`;

        console.log(`[Xpass] Navigating to Embed: ${embedUrl}`);
        
        const resp = await fetch(embedUrl, { headers: BASE_HEADERS });
        const html = await resp.text();
        
        const backupsMatch = html.match(/var backups\s*=\s*(\[.*?\])\s*(?:;|<\/script>)/s);
        if (!backupsMatch) {
            console.log(`[Xpass] No backups variable found in page source.`);
            return [];
        }
        
        let backups = [];
        try {
            backups = JSON.parse(backupsMatch[1]);
        } catch (e) {
            console.error(`[Xpass] Failed parsing backups JSON:`, e);
            return [];
        }
        
        console.log(`[Xpass] Found ${backups.length} servers.`);
        
        for (const backup of backups) {
            try {
                const serverName = backup.name || "Default";
                let serverUrl = backup.url;
                
                if (!serverUrl) continue;
                if (!serverUrl.startsWith('http')) {
                    serverUrl = XPASS_API + serverUrl;
                }
                
                console.log(`[Xpass] Fetching JSON from backup server: ${serverUrl}`);
                
                const jsonResp = await fetch(serverUrl, { headers: BASE_HEADERS });
                const data = await jsonResp.json();
                
                const playlist = data.playlist || [];
                if (playlist.length === 0) continue;
                
                const sources = playlist[0].sources || [];
                
                for (const src of sources) {
                    const fileUrl = src.file;
                    if (!fileUrl || !fileUrl.startsWith('http')) continue;
                    
                    const isM3u8 = (src.type && src.type.toLowerCase().includes('hls')) || fileUrl.includes('.m3u8');
                    
                    if (isM3u8) {
                        const variants = await generateM3u8(serverName, fileUrl, BASE_HEADERS);
                        variants.forEach(v => {
                            streams.push({
                                name: `Xpass [${serverName}]`,
                                title: v.quality,
                                url: v.url,
                                quality: v.quality,
                                type: "m3u8",
                                headers: {
                                    "Referer": `${XPASS_API}/`,
                                    "User-Agent": BASE_HEADERS["User-Agent"]
                                },
                                provider: "xpass"
                            });
                        });
                    } else {
                        streams.push({
                            name: `Xpass [${serverName}]`,
                            title: "Auto",
                            url: fileUrl,
                            quality: "Auto",
                            type: fileUrl.includes(".mp4") || fileUrl.includes(".mkv") ? "video" : null,
                            headers: {
                                "Referer": `${XPASS_API}/`,
                                "User-Agent": BASE_HEADERS["User-Agent"]
                            },
                            provider: "xpass"
                        });
                    }
                }
                
                
            } catch (srvErr) {
                console.warn(`[Xpass] Failed querying server ${backup.name}:`, srvErr.message);
            }
        }
        
    } catch (error) {
        console.error(`[Xpass] Unexpected overall error:`, error.message);
    }

    console.log(`[Xpass] Returning ${streams.length} parsed streams.`);
    return streams;
}

module.exports = { getStreams };
