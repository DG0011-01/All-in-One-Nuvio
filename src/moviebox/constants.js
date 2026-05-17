export const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
export const TMDB_BASE_URL = "https://api.themoviedb.org/3";

export const MOVIEBOX_HOST = "h5.aoneroom.com";
export const MOVIEBOX_API = `https://${MOVIEBOX_HOST}`;

export const BASE_HEADERS = {
    "X-Client-Info": "{\"timezone\":\"Africa/Nairobi\"}",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept": "application/json",
    "Referer": `${MOVIEBOX_API}/`,
    "Host": MOVIEBOX_HOST,
    "Connection": "keep-alive",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};
