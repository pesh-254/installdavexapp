const axios = require('axios');

const LYRICS_API = {
    baseURL: "https://iamtkm.vercel.app",
    endpoint: "/search/lyrics",
    apiKey: "tkm"
};

function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "status@broadcast",
            fromMe: false,
            id: "DAVE-X"
        },
        message: {
            contactMessage: {
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:DAVE X\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function searchLyrics(query) {
    try {
        const url = `${LYRICS_API.baseURL}${LYRICS_API.endpoint}?apikey=${LYRICS_API.apiKey}&q=${encodeURIComponent(query)}`;
        const res = await axios.get(url, { timeout: 10000 });

        if (res.data.status && res.data.data) {
            return res.data.data;
        }
        return [];
    } catch (err) {
        console.error('Lyrics search error:', err.message);
        return [];
    }
}

async function getLyricsText(lyricsUrl) {
    try {
        const res = await axios.get(lyricsUrl, { timeout: 15000 });
        return res.data.lyrics || res.data.result || "Lyrics not available";
    } catch (err) {
        console.error('Fetch lyrics error:', err.message);
        return "Could not fetch lyrics";
    }
}

function formatResultsList(results, query) {
    let message = `🎵 *Multiple Results Found*\n\nSearch: "${query}"\n\n`;

    results.slice(0, 10).forEach((song, index) => {
        message += `${index + 1}. ${song.songTitle}\n   👤 ${song.artist.replace('·', '').trim()}\n\n`;
    });

    message += `\nTo get lyrics, search more specifically\nExample: .lyrics ${results[0].songTitle}`;
    return message;
}

function formatLyrics(song, lyrics) {
    return `🎵 *${song.songTitle}*\n` +
           `👤 *Artist:* ${song.artist.replace('·', '').trim()}\n\n` +
           `${'─'.repeat(30)}\n\n` +
           lyrics.substring(0, 3000) +
           `\n\n- DAVE X`;
}

async function lyricsCommand(sock, chatId, message) {
    const fake = createFakeContact(message);

    const text = message.message?.conversation || 
                 message.message?.extendedTextMessage?.text || '';

    const query = text.split(' ').slice(1).join(' ').trim();

    if (!query) {
        return sock.sendMessage(chatId, { 
            text: "Provide song name after .lyrics\n\nExample: .lyrics suzana by bien"
        }, { quoted: fake });
    }

    try {
        await sock.sendMessage(chatId, { 
            text: `🔍 Searching lyrics for: "${query}"...`
        }, { quoted: fake });

        const results = await searchLyrics(query);

        if (!results || results.length === 0) {
            return sock.sendMessage(chatId, { 
                text: `❌ No lyrics found for: ${query}\n\nTry:\n- Different spelling\n- Artist name only\n- Song title only`
            }, { quoted: fake });
        }

        if (results.length === 1) {
            const lyrics = await getLyricsText(results[0].songLyricsUrl);
            await sock.sendMessage(chatId, { 
                text: formatLyrics(results[0], lyrics)
            }, { quoted: fake });
        } else {
            // Auto-select first result if multiple found
            const lyrics = await getLyricsText(results[0].songLyricsUrl);
            await sock.sendMessage(chatId, { 
                text: formatLyrics(results[0], lyrics)
            }, { quoted: fake });
            
            // Optionally show other results
            if (results.length > 1) {
                await sock.sendMessage(chatId, { 
                    text: formatResultsList(results, query)
                }, { quoted: fake });
            }
        }

    } catch (error) {
        console.error("Lyrics Error:", error);
        await sock.sendMessage(chatId, { 
            text: "Failed to fetch lyrics"
        }, { quoted: fake });
    }
}

module.exports = lyricsCommand;