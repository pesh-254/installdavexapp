const axios = require('axios');
const fs = require('fs');
const path = require('path');

function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "DAVE-X",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:DAVE-X\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Phone\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function facebookCommand(sock, chatId, message) {
    let tempFile = null;

    try {
        const fake = createFakeContact(message);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const url = text.split(' ').slice(1).join(' ').trim();

        console.log('Facebook Command - Input URL:', url);

        if (!url) {
            return await sock.sendMessage(chatId, { 
                text: "Please provide a Facebook video URL."
            }, { quoted: fake });
        }

        // Validate Facebook URL
        const facebookPatterns = [
            'facebook.com',
            'fb.watch',
            'fb.com'
        ];

        const isFacebookUrl = facebookPatterns.some(pattern => url.includes(pattern));
        if (!isFacebookUrl) {
            return await sock.sendMessage(chatId, { 
                text: "Invalid Facebook video URL."
            }, { quoted: fake });
        }

        // Send loading reaction
        await sock.sendMessage(chatId, {
            react: { text: '⬇️', key: message.key }
        });

        // Use API
        const apiUrl = `https://apiskeith.vercel.app/download/fbdown?url=${encodeURIComponent(url)}`;
        let apiResult;

        try {
            const response = await axios.get(apiUrl, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            apiResult = response.data;
            console.log('API response status:', apiResult?.status);
            console.log('API result structure:', apiResult?.result ? 'Has result' : 'No result');
        } catch (error) {
            console.error('API call failed:', error.message);
            throw new Error('Download service unavailable');
        }

        // Check if API returned valid data
        if (!apiResult?.status || !apiResult?.result) {
            throw new Error('Invalid API response');
        }

        // Extract video URL from API response
        let fbvid = null;
        let title = "Facebook Video";

        // Get title
        if (apiResult.result.title && apiResult.result.title !== "Facebook") {
            title = apiResult.result.title;
        }

        // Get video URL - prefer HD, fallback to SD
        if (apiResult.result.media) {
            if (apiResult.result.media.hd) {
                fbvid = apiResult.result.media.hd;
                console.log('Using HD quality');
            } else if (apiResult.result.media.sd) {
                fbvid = apiResult.result.media.sd;
                console.log('Using SD quality');
            }
        }

        if (!fbvid) {
            throw new Error('Video not found in API response');
        }

        console.log('Video URL found:', fbvid.substring(0, 100) + '...');

        // Try URL method first
        try {
            const caption = `${title}\n\nBy DAVE-X Bot`;

            await sock.sendMessage(chatId, {
                video: { url: fbvid },
                mimetype: "video/mp4",
                caption: caption
            }, { quoted: fake });

            console.log('Video sent successfully via URL');
            return;

        } catch (urlError) {
            console.error('URL method failed, trying download method:', urlError.message);

            // Fallback to download method
            const tmpDir = path.join(process.cwd(), 'tmp');
            if (!fs.existsSync(tmpDir)) {
                fs.mkdirSync(tmpDir, { recursive: true });
            }

            tempFile = path.join(tmpDir, `fb_${Date.now()}.mp4`);

            // Download the video with proper headers
            const videoResponse = await axios({
                method: 'GET',
                url: fbvid,
                responseType: 'stream',
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8',
                    'Referer': 'https://www.facebook.com/',
                    'Accept-Language': 'en-US,en;q=0.9'
                }
            });

            const writer = fs.createWriteStream(tempFile);
            videoResponse.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
                setTimeout(() => reject(new Error('Download timeout')), 30000);
            });

            // Verify file
            const stats = fs.statSync(tempFile);
            if (stats.size === 0) {
                throw new Error('Downloaded file is empty');
            }

            console.log(`Downloaded ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

            // Send downloaded video
            const caption = `${title}\n\nBy DAVE-X Bot`;

            await sock.sendMessage(chatId, {
                video: fs.readFileSync(tempFile),
                mimetype: "video/mp4",
                caption: caption
            }, { quoted: fake });

            console.log('Video sent via download method');
        }

    } catch (error) {
        console.error('Facebook command error:', error.message);

        let errorMessage;

        if (error.message.includes('Please provide')) {
            errorMessage = "Please provide a Facebook video URL.";
        } else if (error.message.includes('Invalid Facebook')) {
            errorMessage = "Invalid Facebook video URL.";
        } else if (error.message.includes('Video not found')) {
            errorMessage = "Video not found or inaccessible.";
        } else if (error.message.includes('Download service')) {
            errorMessage = "Download service unavailable.";
        } else if (error.message.includes('Invalid API response')) {
            errorMessage = "API returned invalid data.";
        } else if (error.message.includes('timeout')) {
            errorMessage = "Request timeout.";
        } else {
            errorMessage = "Failed to download video.";
        }

        const fake = createFakeContact(message);
        await sock.sendMessage(chatId, { 
            text: errorMessage
        }, { quoted: fake });

    } finally {
        // Clean up temp file
        if (tempFile && fs.existsSync(tempFile)) {
            try {
                fs.unlinkSync(tempFile);
                console.log('Temp file cleaned up');
            } catch (cleanupError) {
                // Ignore cleanup errors
            }
        }
    }
}

module.exports = facebookCommand;