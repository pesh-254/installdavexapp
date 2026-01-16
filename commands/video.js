const axios = require('axios');
const yts = require('yt-search');

// Meta API configuration
const META_API = {
    baseURL: "https://meta-api.zone.id",
    endpoint: "/downloader/youtube"
};

const AXIOS_DEFAULTS = {
    timeout: 60000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
    }
};

function createFakeContact(message) {
    const phone = message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0];
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "DAVE-X",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Dave-X;;;\nFN:DAVE-X\nTEL;waid=${phone}:${phone}\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function tryRequest(getter, attempts = 3) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await getter();
        } catch (err) {
            lastError = err;
            if (attempt < attempts) {
                await new Promise(r => setTimeout(r, 1000 * attempt));
            }
        }
    }
    throw lastError;
}

// FIXED: Changed to use Meta API with proper response structure
async function getMetaVideoByUrl(youtubeUrl) {
    const apiUrl = `${META_API.baseURL}${META_API.endpoint}?url=${encodeURIComponent(youtubeUrl)}&format=720`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    
    // Check if response matches Meta API structure
    if (res?.data?.status === true && res.data.result?.download) {
        return {
            download: res.data.result.download,
            title: res.data.result.title,
            thumbnail: res.data.result.thumbnail,
            quality: res.data.result.quality || '720'
        };
    }
    throw new Error('Meta API no download');
}

// Keep your original fallback function (unchanged)
async function getOkatsuVideoByUrl(youtubeUrl) {
    const apiUrl = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp4?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.result?.mp4) {
        return { download: res.data.result.mp4, title: res.data.result.title };
    }
    throw new Error('Okatsu no mp4');
}

async function videoCommand(sock, chatId, message) {
    const fkontak = createFakeContact(message);

    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.split(' ').slice(1).join(' ').trim();

        if (!searchQuery) {
            await sock.sendMessage(chatId, { text: 'What video to download?' }, { quoted: fkontak });
            return;
        }

        let videoUrl = '';
        let videoTitle = '';
        let videoThumbnail = '';
        if (searchQuery.startsWith('http://') || searchQuery.startsWith('https://')) {
            videoUrl = searchQuery;
        } else {
            const { videos } = await yts(searchQuery);
            if (!videos || videos.length === 0) {
                await sock.sendMessage(chatId, { text: 'No videos found.' }, { quoted: fkontak });
                return;
            }
            videoUrl = videos[0].url;
            videoTitle = videos[0].title;
            videoThumbnail = videos[0].thumbnail;
        }

        try {
            const ytId = (videoUrl.match(/(?:youtu\.be\/|v=)([a-zA-Z0-9_-]{11})/) || [])[1];
            const thumb = videoThumbnail || (ytId ? `https://i.ytimg.com/vi/${ytId}/sddefault.jpg` : undefined);
            if (thumb) {
                await sock.sendMessage(chatId, {
                    image: { url: thumb },
                    caption: `Downloading video...`
                }, { quoted: fkontak });
            }
        } catch (e) { console.error('Thumb error:', e?.message || e); }

        let urls = videoUrl.match(/(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|v\/|embed\/|shorts\/|playlist\?list=)?)([a-zA-Z0-9_-]{11})/gi);
        if (!urls) {
            await sock.sendMessage(chatId, { text: 'Invalid YouTube link.' }, { quoted: fkontak });
            return;
        }

        let videoData;
        try {
            // FIXED: Using Meta API instead of Izumi
            videoData = await getMetaVideoByUrl(videoUrl);
        } catch (e1) {
            // Fallback to Okatsu if Meta fails
            videoData = await getOkatsuVideoByUrl(videoUrl);
        }

        await sock.sendMessage(chatId, {
            video: { url: videoData.download },
            mimetype: 'video/mp4',
            fileName: `${videoData.title || videoTitle || 'video'}.mp4`,
            caption: `${videoData.title || videoTitle || 'Video'}\nQuality: ${videoData.quality || '720p'}\nDownloaded by DAVE-X`
        }, { quoted: fkontak });

    } catch (error) {
        console.error('Video command error:', error?.message || error);
        await sock.sendMessage(chatId, { text: 'Download failed: ' + (error?.message || 'Error') }, { quoted: fkontak });
    }
}

module.exports = videoCommand;