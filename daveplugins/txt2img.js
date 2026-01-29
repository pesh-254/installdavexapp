import fs from 'fs';
import path from 'path';
import axios from 'axios';

// Load emojis
const emojisPath = path.join(process.cwd(), 'data', 'emojis.json');
const emojis = JSON.parse(fs.readFileSync(emojisPath, 'utf8'));

const COMMANDS = {
    txt2cartoon: 'https://apis.prexzyvilla.site/ai/cartoon',
    txt2pixelart: 'https://apis.prexzyvilla.site/ai/pixel-art',
    txt2sketch: 'https://apis.prexzyvilla.site/ai/sketch',
    txt2abstractimg: 'https://apis.prexzyvilla.site/ai/abstract',
    txt2minimalistimg: 'https://apis.prexzyvilla.site/ai/minimalist',
    txt2vintage: 'https://apis.prexzyvilla.site/ai/vintage',
    txt2steampunk: 'https://apis.prexzyvilla.site/ai/steampunk',
    txt2horror: 'https://apis.prexzyvilla.site/ai/horror',
    txt2scifi: 'https://apis.prexzyvilla.site/ai/sci-fi',
};

function createTxt2ImageCommand(name, endpoint) {
    return {
        name,
        description: `Generate ${name.replace('txt2', '')} AI image`,
        async execute(msg, { sock, args }) {
            try {
                const input = args.join(' ');
                if (!input) {
                    return sock.sendMessage(
                        msg.key.remoteJid,
                        { text: `${emojis.error} *Usage:* ${name} <prompt> | <negative prompt (optional)>` },
                        { quoted: msg }
                    );
                }

                const [prompt, negativePrompt] = input.split('|').map(v => v?.trim());

                await sock.sendMessage(msg.key.remoteJid, {
                    react: { text: emojis.processing, key: msg.key },
                });

                // 🔥 BUILD PARAMS SAFELY
                const params = { prompt };
                if (negativePrompt) params.negative_prompt = negativePrompt;

                const response = await axios.get(endpoint, {
                    params,
                    responseType: 'arraybuffer',
                    timeout: 60000,
                    headers: {
                        Accept: 'image/*',
                    },
                });

                const imageBuffer = Buffer.from(response.data);

                await sock.sendMessage(
                    msg.key.remoteJid,
                    {
                        image: imageBuffer,
                        caption:
                            `${emojis.success} *Image Generated!*\n` +
                            `🎨 *Style:* ${name.replace('txt2', '')}\n` +
                            `📝 *Prompt:* ${prompt}` +
                            (negativePrompt ? `\n🚫 *Negative:* ${negativePrompt}` : ''),
                    },
                    { quoted: msg }
                );

                await sock.sendMessage(msg.key.remoteJid, {
                    react: { text: emojis.success, key: msg.key },
                });

            } catch (err) {
                console.error(`${name} error:`, err.response?.status, err.message);

                await sock.sendMessage(
                    msg.key.remoteJid,
                    {
                        text: `${emojis.error} Request failed.\nStatus: ${err.response?.status || 'unknown'
                            }`,
                    },
                    { quoted: msg }
                );
            }
        },
    };
}

// ✅ EXPORT ALL COMMANDS
export default Object.entries(COMMANDS).map(([name, url]) =>
    createTxt2ImageCommand(name, url)
);

