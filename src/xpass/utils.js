export async function generateM3u8(streamName, masterUrl, headers = {}) {
    try {
        console.log(`[Xpass] Parsing master m3u8: ${masterUrl}`);
        const resp = await fetch(masterUrl, { headers });
        const text = await resp.text();
        
        const baseUri = masterUrl.substring(0, masterUrl.lastIndexOf('/')) + '/';
        const results = [];
        
        const regex = /#EXT-X-STREAM-INF:.*?RESOLUTION=(\d+x\d+).*?\n([^\n]+)/g;
        let match;
        
        while ((match = regex.exec(text)) !== null) {
            const res = match[1].split('x')[1] + 'p';
            let url = match[2].trim();
            
            if (!url.startsWith('http')) {
                if (url.startsWith('/')) {
                    const root = new URL(masterUrl).origin;
                    url = root + url;
                } else {
                    url = baseUri + url;
                }
            }
            
            results.push({
                quality: res,
                url: url
            });
        }
        
        if (results.length === 0) {
            return [{ quality: 'Auto', url: masterUrl }];
        }
        
        return results;
    } catch (err) {
        console.warn(`[Xpass] Error parsing M3U8, returning master URL.`, err);
        return [{ quality: 'Auto', url: masterUrl }];
    }
}
