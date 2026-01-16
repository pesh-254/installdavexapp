const axios = require('axios');

// Create fake contact for enhanced replies
function createFakeContact(message) {
    const participant = message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0];
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "status@broadcast",
            fromMe: false,
            id: ""
        },
        message: {
            contactMessage: {
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:DAVE MD\nitem1.TEL;waid=${participant}:${participant}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

// Normalize API responses into a consistent array of image URLs
function normalizeImageResponse(apiUrl, data) {
    if (apiUrl.includes('mrfrankofc')) {
        if (data.status === true && Array.isArray(data.result)) return data.result;
        if (Array.isArray(data.data)) return data.data;
    }
    if (apiUrl.includes('davidcyriltech')) {
        if (data.success && Array.isArray(data.results)) return data.results;
    }
    return [];
}

async function searchImagesFromAPI(apiUrl) {
    try {
        const response = await axios.get(apiUrl, {
            timeout: 15000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        return normalizeImageResponse(apiUrl, response.data);
    } catch (error) {
        console.error(`API error (${apiUrl}):`, error.message);
        return [];
    }
}

async function imgCommand(sock, chatId, senderId, message, userMessage) {
    const fake = createFakeContact(message);
    const args = userMessage.trim().split(/\s+/).slice(1);
    const query = args.join(' ');

    if (!query) {
        return sock.sendMessage(chatId, {
            text: `🖼️ *Image Search Command*\n\nUsage:\n${getPrefix()}img <search_query>\n\nExamples:\n${getPrefix()}img cute cats\n${getPrefix()}img nature landscape`
        }, { quoted: fake });
    }

    await sock.sendMessage(chatId, { text: `🔍 Searching images for "${query}"...` }, { quoted: fake });

    const apis = [
        `https://api.mrfrankofc.gleeze.com/api/images?query=${encodeURIComponent(query)}`,
        `https://api.davidcyriltech.com/images?query=${encodeURIComponent(query)}`
    ];

    let images = [];
    let usedAPI = '';

    for (const apiUrl of apis) {
        images = await searchImagesFromAPI(apiUrl);
        if (images.length > 0) {
            usedAPI = apiUrl.includes('mrfrankofc') ? 'MrFrank API' : 'David Cyril API';
            break;
        }
    }

    if (images.length === 0) {
        return sock.sendMessage(chatId, {
            text: '❌ No images found. Try different keywords.'
        }, { quoted: fake });
    }

    const imagesToSend = images.slice(0, 5);
    let sentCount = 0;

    for (const img of imagesToSend) {
        try {
            const imageUrl = typeof img === 'string' ? img : img.url || img.link;
            if (!imageUrl) continue;

            await sock.sendMessage(chatId, { image: { url: imageUrl }, caption: query }, { quoted: fake });

            sentCount++;
            await new Promise(res => setTimeout(res, 1500)); // pacing
        } catch (err) {
            console.error('Error sending image:', err.message);
        }
    }

    if (sentCount > 0) {
        await sock.sendMessage(chatId, {
            text: `✅ Sent ${sentCount} images for "${query}"\n\n📸 *Total Found:* ${images.length} (via ${usedAPI})`
        }, { quoted: fake });
    }
}

function getPrefix() {
    try {
        const { getPrefix } = require('./setprefix');
        return getPrefix();
    } catch {
        return '.';
    }
}

module.exports = imgCommand;
