import axios from 'axios';
import fs from 'fs';
import path from 'path';

const emojisPath = path.join(process.cwd(), 'data', 'emojis.json');
const emojis = JSON.parse(fs.readFileSync(emojisPath, 'utf8'));

const PREXZY_NSFW_API = 'https://apis.prexzyvilla.site/nsfw';

async function fetchNsfwContent(category) {
    try {
        const response = await axios.get(`${PREXZY_NSFW_API}/${category}`, {
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const contentType = response.headers['content-type'] || '';
        const buffer = Buffer.from(response.data);
        
        return {
            buffer,
            contentType,
            isGif: contentType.includes('gif'),
            isVideo: contentType.includes('video') || contentType.includes('mp4'),
            isImage: contentType.includes('image')
        };
    } catch (error) {
        console.error(`[NSFW ${category}] API Error:`, error.message);
        return null;
    }
}

function createNsfwCommand(name, category, description) {
    return {
        name: name,
        description: description,
        async execute(msg, { sock, settings }) {
            const from = msg.key.remoteJid;
            
            if (from.endsWith('@g.us')) {
                const nsfwEnabled = global.nsfwGroups?.[from];
                if (!nsfwEnabled) {
                    return await sock.sendMessage(from, {
                        text: `${emojis.error} NSFW commands are disabled in this group!\n\nAn admin can enable with: ${settings.prefix}nsfw on`
                    }, { quoted: msg });
                }
            }
            
            try {
                await sock.sendMessage(from, {
                    react: { text: emojis.processing, key: msg.key }
                });
                
                const content = await fetchNsfwContent(category);
                
                if (!content || !content.buffer || content.buffer.length < 1000) {
                    return await sock.sendMessage(from, {
                        text: `${emojis.error} Failed to fetch ${name} content. Try again later.`
                    }, { quoted: msg });
                }
                
                const caption = `🔞 *${name.toUpperCase()}*\n\n_NSFW Content - 18+ Only_`;
                
                if (content.isGif || content.isVideo) {
                    await sock.sendMessage(from, {
                        video: content.buffer,
                        gifPlayback: content.isGif,
                        caption: caption
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(from, {
                        image: content.buffer,
                        caption: caption
                    }, { quoted: msg });
                }
                
                await sock.sendMessage(from, {
                    react: { text: emojis.success, key: msg.key }
                });
                
            } catch (error) {
                console.error(`[NSFW ${name}] Error:`, error.message);
                await sock.sendMessage(from, {
                    text: `${emojis.error} Failed to fetch content: ${error.message}`
                }, { quoted: msg });
            }
        }
    };
}

const nsfwToggleCommand = {
    name: 'nsfw',
    description: 'Toggle NSFW commands in group',
    async execute(msg, { sock, args, settings }) {
        const from = msg.key.remoteJid;
        
        if (!from.endsWith('@g.us')) {
            return await sock.sendMessage(from, {
                text: `${emojis.error} This command only works in groups!`
            }, { quoted: msg });
        }
        
        const action = args[0]?.toLowerCase();
        
        if (!action || !['on', 'off', 'status'].includes(action)) {
            return await sock.sendMessage(from, {
                text: `🔞 *NSFW Settings*\n\n• ${settings.prefix}nsfw on - Enable NSFW\n• ${settings.prefix}nsfw off - Disable NSFW\n• ${settings.prefix}nsfw status - Check status`
            }, { quoted: msg });
        }
        
        if (!global.nsfwGroups) global.nsfwGroups = {};
        
        if (action === 'on') {
            global.nsfwGroups[from] = true;
            await sock.sendMessage(from, {
                text: `${emojis.success} NSFW commands *enabled* in this group!\n\n⚠️ 18+ content only.`
            }, { quoted: msg });
        } else if (action === 'off') {
            global.nsfwGroups[from] = false;
            await sock.sendMessage(from, {
                text: `${emojis.success} NSFW commands *disabled* in this group.`
            }, { quoted: msg });
        } else {
            const status = global.nsfwGroups[from] ? 'Enabled' : 'Disabled';
            await sock.sendMessage(from, {
                text: `🔞 NSFW Status: *${status}*`
            }, { quoted: msg });
        }
    }
};

const assCommand = createNsfwCommand('ass', 'ass', 'Get NSFW ass content');
const ahegaoCommand = createNsfwCommand('ahegao', 'ahegao', 'Get NSFW ahegao content');
const bdsm = createNsfwCommand('bdsm', 'bdsm', 'Get NSFW bdsm content');
const blowjobCommand = createNsfwCommand('blowjob', 'blowjob', 'Get NSFW blowjob content');
const cumCommand = createNsfwCommand('cum', 'cum', 'Get NSFW cum content');
const feetCommand = createNsfwCommand('feet', 'feet', 'Get NSFW feet content');
const gangbangCommand = createNsfwCommand('gangbang', 'gangbang', 'Get NSFW gangbang content');
const hentaiCommand = createNsfwCommand('hentai', 'hentai', 'Get NSFW hentai content');
const lesbianCommand = createNsfwCommand('lesbian', 'lesbian', 'Get NSFW lesbian content');
const milfCommand = createNsfwCommand('milf', 'milf', 'Get NSFW milf content');
const nekoNsfw = createNsfwCommand('nekonsfw', 'neko', 'Get NSFW neko content');
const oralCommand = createNsfwCommand('oral', 'oral', 'Get NSFW oral content');
const pussyCommand = createNsfwCommand('pussy', 'pussy', 'Get NSFW pussy content');
const thighsCommand = createNsfwCommand('thighs', 'thighs', 'Get NSFW thighs content');
const titsCommand = createNsfwCommand('tits', 'tits', 'Get NSFW tits content');
const trapCommand = createNsfwCommand('trap', 'trap', 'Get NSFW trap content');
const waifuNsfw = createNsfwCommand('waifunsfw', 'waifu', 'Get NSFW waifu content');
const yaoi = createNsfwCommand('yaoi', 'yaoi', 'Get NSFW yaoi content');
const yuri = createNsfwCommand('yuri', 'yuri', 'Get NSFW yuri content');
const boobsCommand = createNsfwCommand('boobs', 'boobs', 'Get NSFW boobs content');

export default [
    nsfwToggleCommand,
    assCommand,
    ahegaoCommand,
    bdsm,
    blowjobCommand,
    cumCommand,
    feetCommand,
    gangbangCommand,
    hentaiCommand,
    lesbianCommand,
    milfCommand,
    nekoNsfw,
    oralCommand,
    pussyCommand,
    thighsCommand,
    titsCommand,
    trapCommand,
    waifuNsfw,
    yaoi,
    yuri,
    boobsCommand
];
