const fetch = require('node-fetch');

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

async function inspectCommand(sock, chatId, senderId, message, userMessage) {
    const fkontak = createFakeContact(message);
    
    try {
        const args = userMessage.split(' ').slice(1);
        const query = args.join(' ');

        if (!query) {
            return await sock.sendMessage(chatId, {
                text: "Usage: .inspect <url>"
            }, { quoted: fkontak });
        }

        await sock.sendMessage(chatId, {
            text: `Inspecting...`
        }, { quoted: fkontak });

        // Parse arguments
        const parts = query.split(' ');
        const url = parts[0];
        const flags = parts.slice(1);
        const download = flags.includes('-d');
        const json = flags.includes('-j');
        const headersOnly = flags.includes('-h');

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            },
            timeout: 10000
        });

        const responseInfo = {
            status: response.status,
            statusText: response.statusText,
            url: response.url,
            headers: {}
        };

        response.headers.forEach((value, key) => {
            responseInfo.headers[key] = value;
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type') || '';

        if (headersOnly) {
            let headersText = `Status: ${responseInfo.status} ${responseInfo.statusText}\n`;
            headersText += `URL: ${responseInfo.url}\n\n`;

            for (const [key, value] of Object.entries(responseInfo.headers)) {
                headersText += `${key}: ${value}\n`;
            }

            return await sock.sendMessage(chatId, { text: headersText }, { quoted: fkontak });
        }

        // Handle media download
        if (download && (contentType.includes('audio/') ||
                         contentType.includes('video/') ||
                         contentType.includes('image/'))) {

            const buffer = await response.arrayBuffer();
            const fileBuffer = Buffer.from(buffer);

            let mediaMsg;

            if (contentType.includes('audio/')) {
                mediaMsg = { audio: fileBuffer, mimetype: contentType };
            } else if (contentType.includes('video/')) {
                mediaMsg = { video: fileBuffer, mimetype: contentType };
            } else if (contentType.includes('image/')) {
                mediaMsg = { image: fileBuffer, mimetype: contentType };
            }

            await sock.sendMessage(chatId, mediaMsg, { quoted: fkontak });
            return;
        }

        // Handle JSON
        if (json || contentType.includes('application/json')) {
            let jsonData;
            try {
                jsonData = await response.json();
            } catch (err) {
                jsonData = null;
            }

            const formattedJson = jsonData ? JSON.stringify(jsonData, null, 2) : '{}';

            return await sock.sendMessage(chatId, { 
                text: `\`\`\`json\n${formattedJson}\n\`\`\`` 
            }, { quoted: fkontak });
        }

        // Handle text
        if (contentType.includes('text/')) {
            const text = await response.text();
            return await sock.sendMessage(chatId, { 
                text: text.length > 4000 ? text.substring(0, 4000) + "..." : text 
            }, { quoted: fkontak });
        }

        // Fallback
        await sock.sendMessage(chatId, {
            text: `Status: ${responseInfo.status}\nContent-Type: ${contentType}`
        }, { quoted: fkontak });

    } catch (error) {
        console.error('Inspect error:', error.message);

        let errorMessage;
        if (error.name === 'AbortError' || error.message.includes('timeout')) {
            errorMessage = 'Request timeout.';
        } else if (error.code === 'ENOTFOUND') {
            errorMessage = 'Could not resolve domain.';
        } else if (error.code === 'ECONNREFUSED') {
            errorMessage = 'Connection refused.';
        } else if (error.message.includes('HTTP')) {
            errorMessage = `Error: ${error.message}`;
        } else {
            errorMessage = 'Failed to inspect URL.';
        }

        await sock.sendMessage(chatId, { text: errorMessage }, { quoted: fkontak });
    }
}

module.exports = inspectCommand;