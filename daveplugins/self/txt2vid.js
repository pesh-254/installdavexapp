import fs from 'fs';
import path from 'path';
import axios from 'axios';

// Load emojis
const emojisPath = path.join(process.cwd(), 'data', 'emojis.json');
const emojis = JSON.parse(fs.readFileSync(emojisPath, 'utf8'));

const TXT2VIDEO_URL =
    'https://omegatech-api.dixonomega.tech/api/ai/Txt2video';

export default {
    name: "txt2vid",
    description: "Generate an AI video from text (Txt2Video).",
    async execute(msg, { sock, args }) {
        try {
            const prompt = args.join(' ');

            if (!prompt) {
                return sock.sendMessage(
                    msg.key.remoteJid,
                    { text: `${emojis.error} *Usage:* txt2vid <prompt>` },
                    { quoted: msg }
                );
            }

            // React: processing
            await sock.sendMessage(msg.key.remoteJid, {
                react: { text: emojis.processing, key: msg.key },
            });

            const response = await axios.get(TXT2VIDEO_URL, {
                params: { prompt },
                timeout: 60000,
                headers: { Accept: 'application/json' },
            });

            if (!response.data?.success || !response.data?.video_url) {
                return sock.sendMessage(
                    msg.key.remoteJid,
                    { text: `${emojis.error} Failed to generate video.` },
                    { quoted: msg }
                );
            }

            const videoUrl = response.data.video_url;

            // Send video
            await sock.sendMessage(
                msg.key.remoteJid,
                {
                    video: { url: videoUrl },
                    caption: `${emojis.success} *Txt2Video generated successfully!*\n\n📝 *Prompt:* ${prompt}`,
                },
                { quoted: msg }
            );

            // React: success
            await sock.sendMessage(msg.key.remoteJid, {
                react: { text: emojis.success, key: msg.key },
            });

        } catch (err) {
            console.error('txt2vid error:', err.response?.data || err.message);

            await sock.sendMessage(
                msg.key.remoteJid,
                {
                    text: `${emojis.error} Error generating video.\n${err.response?.data?.message || err.message
                        }`,
                },
                { quoted: msg }
            );
        }
    },
};
