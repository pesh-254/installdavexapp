import fs from 'fs';
import path from 'path';
import axios from 'axios';

// Load emojis
const emojisPath = path.join(process.cwd(), 'data', 'emojis.json');
const emojis = JSON.parse(fs.readFileSync(emojisPath, 'utf8'));

const FLUX_URL =
    'https://omegatech-api.dixonomega.tech/api/ai/flux';

export default {
    name: "flux",
    description: "Generate AI image using Flux.",
    async execute(msg, { sock, args }) {
        try {
            const prompt = args.join(' ');

            if (!prompt) {
                return sock.sendMessage(
                    msg.key.remoteJid,
                    { text: `${emojis.error} *Usage:* flux <prompt>` },
                    { quoted: msg }
                );
            }

            // React: processing
            await sock.sendMessage(msg.key.remoteJid, {
                react: { text: emojis.processing, key: msg.key },
            });

            // ⚠️ IMPORTANT: responseType = arraybuffer
            const response = await axios.get(FLUX_URL, {
                params: { prompt },
                responseType: 'arraybuffer',
                timeout: 60000,
            });

            // Convert raw image to buffer
            const imageBuffer = Buffer.from(response.data);

            // Send image directly
            await sock.sendMessage(
                msg.key.remoteJid,
                {
                    image: imageBuffer,
                    caption: `${emojis.success} *Flux image generated!*\n\n📝 *Prompt:* ${prompt}`,
                },
                { quoted: msg }
            );

            // React: success
            await sock.sendMessage(msg.key.remoteJid, {
                react: { text: emojis.success, key: msg.key },
            });

        } catch (err) {
            console.error('flux error:', err.message);

            await sock.sendMessage(
                msg.key.remoteJid,
                {
                    text: `${emojis.error} Error generating image.\n${err.message}`,
                },
                { quoted: msg }
            );
        }
    },
};


