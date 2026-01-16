const axios = require('axios');

// Store processed message IDs to prevent duplicates
const processedMessages = new Set();

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
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:DAVE-X;;;\nFN:JUNE-X\nTEL;waid=${phone}:${phone}\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function tiktokCommand(sock, chatId, message) {
    const fkontak = createFakeContact(message);

    try {
        // Prevent duplicate processing
        if (processedMessages.has(message.key.id)) return;
        processedMessages.add(message.key.id);
        setTimeout(() => processedMessages.delete(message.key.id), 5 * 60 * 1000);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        if (!text) {
            return await sock.sendMessage(chatId, { 
                text: "Please provide a TikTok link."
            }, { quoted: fkontak });
        }

        const url = text.split(' ').slice(1).join(' ').trim();
        if (!url) {
            return await sock.sendMessage(chatId, { 
                text: "Please provide a TikTok link."
            }, { quoted: fkontak });
        }

        const tiktokPatterns = [
            /tiktok\.com\//,
            /vm\.tiktok\.com\//,
            /vt\.tiktok\.com\//
        ];

        const isValidUrl = tiktokPatterns.some(pattern => pattern.test(url));
        if (!isValidUrl) {
            return await sock.sendMessage(chatId, { 
                text: "Invalid TikTok link."
            }, { quoted: fkontak });
        }

        await sock.sendMessage(chatId, {
            react: { text: '↘️', key: message.key }
        });

        try {
            // API call
            const apiResponse = await axios.get(`https://iamtkm.vercel.app/downloaders/tiktokdl?apikey=tkm&url=${encodeURIComponent(url)}`, {
                timeout: 15000
            });
            const data = apiResponse.data;

            if (data?.status && data.result) {
                const videoUrl = data.result.no_watermark || data.result.watermark;
                
                if (videoUrl) {
                    // Send video with ONLY the small caption
                    await sock.sendMessage(chatId, {
                        video: { url: videoUrl },
                        mimetype: "video/mp4",
                        caption: "DAVE-X your tribal thief"  // Only this caption
                    }, { quoted: fkontak });
                    
                    // DO NOT send audio or any other messages
                    return;
                }
            }

            throw new Error('No video URL found');

        } catch (error) {
            console.error('TikTok API error:', error.message);
            throw new Error('Download service unavailable');
        }

    } catch (error) {
        console.error('TikTok command error:', error.message);

        let errorMessage = "Failed to download video.";
        if (error.message.includes('Invalid TikTok')) {
            errorMessage = "Invalid TikTok link.";
        } else if (error.message.includes('Download service')) {
            errorMessage = "Download service unavailable.";
        } else if (error.message.includes('timeout')) {
            errorMessage = "Request timeout.";
        }

        await sock.sendMessage(chatId, { 
            text: errorMessage
        }, { quoted: fkontak });
    }
}

module.exports = tiktokCommand;