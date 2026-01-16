const yts = require('yt-search');

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

async function ytsCommand(sock, chatId, senderId, message, userMessage) {
    const fkontak = createFakeContact(message);
    
    try {
        const args = userMessage.split(' ').slice(1);
        const query = args.join(' ');

        if (!query) {
            return await sock.sendMessage(chatId, {
                text: "Usage: .yts <search>"
            }, { quoted: fkontak });
        }

        await sock.sendMessage(chatId, {
            text: `Searching for: ${query}...`
        }, { quoted: fkontak });

        let searchResults;
        try {
            searchResults = await yts(query);
        } catch (searchError) {
            console.error('Search error:', searchError.message);
            return await sock.sendMessage(chatId, {
                text: 'Search failed.'
            }, { quoted: fkontak });
        }

        const videos = (searchResults && searchResults.videos) ? searchResults.videos.slice(0, 10) : [];

        if (videos.length === 0) {
            return await sock.sendMessage(chatId, {
                text: `No results for "${query}"`
            }, { quoted: fkontak });
        }

        let resultMessage = `Results for: ${query}\n\n`;

        videos.forEach((video, index) => {
            const duration = video.timestamp || '-';
            const views = video.views ? video.views.toLocaleString() : '-';

            resultMessage += `${index + 1}. ${video.title}\n`;
            resultMessage += `URL: ${video.url}\n`;
            resultMessage += `Duration: ${duration} | Views: ${views}\n\n`;
        });

        await sock.sendMessage(chatId, { text: resultMessage }, { quoted: fkontak });

    } catch (error) {
        console.error('YTS command error:', error.message);
        await sock.sendMessage(chatId, {
            text: 'Search failed.'
        }, { quoted: fkontak });
    }
}

module.exports = ytsCommand;