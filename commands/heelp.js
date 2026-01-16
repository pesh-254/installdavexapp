const settings = require('../settings');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { getMenuStyle, getMenuSettings, MENU_STYLES } = require('./menuSettings');
const { generateWAMessageFromContent } = require('@whiskeysockets/baileys');
const { getPrefix, handleSetPrefixCommand } = require('./setprefix');
const { getOwnerName, handleSetOwnerCommand } = require('./setowner');

function formatTime(seconds) {
    const days = Math.floor(seconds / (24 * 60 * 60));
    seconds = seconds % (24 * 60 * 60);
    const hours = Math.floor(seconds / (60 * 60));
    seconds = seconds % (60 * 60);
    const minutes = Math.floor(seconds / 60);
    seconds = Math.floor(seconds % 60);

    let time = '';
    if (days > 0) time += `${days}d `;
    if (hours > 0) time += `${hours}h `;
    if (minutes > 0) time += `${minutes}m `;
    if (seconds > 0 || time === '') time += `${seconds}s`;

    return time.trim();
}

const detectPlatform = () => {
  if (process.env.DYNO) return "Heroku";
  if (process.env.RENDER) return "Render";
  if (process.env.PREFIX && process.env.PREFIX.includes("termux")) return "Termux";
  if (process.env.PORTS && process.env.CYPHERX_HOST_ID) return "CypherX";
  if (process.env.P_SERVER_UUID) return "Panel";
  if (process.env.LXC) return "Linux Container";
  
  switch (os.platform()) {
    case "win32": return "Windows";
    case "darwin": return "macOS";
    case "linux": return "Linux";
    default: return "Unknown";
  }
};

const hostName = detectPlatform();

const formatMemory = (memory) => {
    return memory < 1024 * 1024 * 1024
        ? Math.round(memory / 1024 / 1024) + ' MB'
        : Math.round(memory / 1024 / 1024 / 1024) + ' GB';
};

const progressBar = (used, total, size = 10) => {
    let percentage = Math.round((used / total) * size);
    let bar = '█'.repeat(percentage) + '░'.repeat(size - percentage);
    return `${bar} ${Math.round((used / total) * 100)}%`;
};

const generateMenu = (pushname, currentMode, hostName, ping, uptimeFormatted, prefix = '.') => {
    const memoryUsage = process.memoryUsage();
    const botUsedMemory = memoryUsage.heapUsed;
    const totalMemory = os.totalmem();
    const systemUsedMemory = totalMemory - os.freemem();
    const prefix2 = getPrefix();
    let newOwner = getOwnerName();
    const menuSettings = getMenuSettings();
    
    let menu = `┏━━━━━✧ DAVE-X MENU ✧━━━━━━━\n`;
    menu += `┃✧ Prefix: [${prefix2}]\n`;
    menu += `┃✧ Owner: ${newOwner}\n`;
    menu += `┃✧ Mode: ${currentMode}\n`;
    menu += `┃✧ Platform: ${hostName}\n`;
    menu += `┃✧ Speed: ${ping} ms\n`;
    
    if (menuSettings.showUptime) {
        menu += `┃✧ Uptime: ${uptimeFormatted}\n`;
    }
    
    menu += `┃✧ Version: v${settings.version}\n`;
    
    if (menuSettings.showMemory) {
        menu += `┃✧ RAM: ${progressBar(systemUsedMemory, totalMemory)}\n`;
    }
    
    menu += `┗━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    menu += `┏━━━━━✧ OWNER MENU ✧━━━━━━━\n`;
    menu += `┃› ${prefix2}ban\n`;
    menu += `┃› ${prefix2}restart\n`;
    menu += `┃› ${prefix2}unban\n`;
    menu += `┃› ${prefix2}promote\n`;
    menu += `┃› ${prefix2}demote\n`;
    menu += `┃› ${prefix2}mute\n`;
    menu += `┃› ${prefix2}unmute\n`;
    menu += `┃› ${prefix2}delete\n`;
    menu += `┃› ${prefix2}kick\n`;
    menu += `┃› ${prefix2}warnings\n`;
    menu += `┃› ${prefix2}antilink\n`;
    menu += `┃› ${prefix2}antibadword\n`;
    menu += `┃› ${prefix2}clear\n`;
    menu += `┃› ${prefix2}chatbot\n`;
    menu += `┗━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    menu += `┏━━━━━✧ GROUP MENU ✧━━━━━━━\n`;
    menu += `┃› ${prefix2}promote\n`;
    menu += `┃› ${prefix2}demote\n`;
    menu += `┃› ${prefix2}settings\n`;
    menu += `┃› ${prefix2}togroupstatus\n`;
    menu += `┃› ${prefix2}tosgroup\n`;
    menu += `┃› ${prefix2}welcome\n`;
    menu += `┃› ${prefix2}setgpp\n`;
    menu += `┃› ${prefix2}getgpp\n`;
    menu += `┃› ${prefix2}listadmin\n`;
    menu += `┃› ${prefix2}goodbye\n`;
    menu += `┃› ${prefix2}tagnoadmin\n`;
    menu += `┃› ${prefix2}tag\n`;
    menu += `┃› ${prefix2}antilink\n`;
    menu += `┃› ${prefix2}set welcome\n`;
    menu += `┃› ${prefix2}groupinfo\n`;
    menu += `┃› ${prefix2}admins\n`;
    menu += `┃› ${prefix2}warn\n`;
    menu += `┃› ${prefix2}revoke\n`;
    menu += `┃› ${prefix2}resetlink\n`;
    menu += `┃› ${prefix2}open\n`;
    menu += `┃› ${prefix2}close\n`;
    menu += `┃› ${prefix2}mention\n`;
    menu += `┃› ${prefix2}setgdesc\n`;
    menu += `┃› ${prefix2}leave\n`;
    menu += `┃› ${prefix2}left\n`;
    menu += `┃› ${prefix2}killall\n`;
    menu += `┃› ${prefix2}removeall\n`;
    menu += `┗━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    menu += `┏━━━━━✧ AI MENU ✧━━━━━━━\n`;
    menu += `┃› ${prefix2}Ai\n`;
    menu += `┃› ${prefix2}gpt\n`;
    menu += `┃› ${prefix2}gemini\n`;
    menu += `┃› ${prefix2}imagine\n`;
    menu += `┃› ${prefix2}flux\n`;
    menu += `┗━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    menu += `┏━━━━━✧ SETTINGS MENU ✧━━━━━━━\n`;
    menu += `┃› ${prefix2}mode\n`;
    menu += `┃› ${prefix2}autostatus\n`;
    menu += `┃› ${prefix2}pmblock\n`;
    menu += `┃› ${prefix2}setmention\n`;
    menu += `┃› ${prefix2}autoread\n`;
    menu += `┃› ${prefix2}clearsession\n`;
    menu += `┃› ${prefix2}antidelete\n`;
    menu += `┃› ${prefix2}cleartmp\n`;
    menu += `┃› ${prefix2}autoreact\n`;
    menu += `┃› ${prefix2}getpp\n`;
    menu += `┃› ${prefix2}setpp\n`;
    menu += `┃› ${prefix2}sudo\n`;
    menu += `┃› ${prefix2}autotyping\n`;
    menu += `┃› ${prefix2}setmenu\n`;
    menu += `┃› ${prefix2}menuconfig reset\n`;
    menu += `┃› ${prefix2}setmenu toggle\n`;
    menu += `┃› ${prefix2}setprefix\n`;
    menu += `┃› ${prefix2}setprefix reset\n`;
    menu += `┗━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    menu += `┏━━━━━✧ MAIN MENU ✧━━━━━━━\n`;
    menu += `┃› ${prefix2}yts\n`;
    menu += `┃› ${prefix2}url\n`;
    menu += `┃› ${prefix2}tourl\n`;
    menu += `┃› ${prefix2}block\n`;
    menu += `┃› ${prefix2}listblock\n`;
    menu += `┃› ${prefix2}blocklist\n`;
    menu += `┃› ${prefix2}tagall\n`;
    menu += `┃› ${prefix2}play\n`;
    menu += `┃› ${prefix2}spotify\n`;
    menu += `┃› ${prefix2}trt\n`;
    menu += `┃› ${prefix2}runtime\n`;
    menu += `┃› ${prefix2}ping\n`;
    menu += `┃› ${prefix2}apk\n`;
    menu += `┃› ${prefix2}vv\n`;
    menu += `┃› ${prefix2}video\n`;
    menu += `┃› ${prefix2}song\n`;
    menu += `┃› ${prefix2}ssweb\n`;
    menu += `┃› ${prefix2}instagram\n`;
    menu += `┃› ${prefix2}facebook\n`;
    menu += `┃› ${prefix2}tiktok\n`;
    menu += `┃› ${prefix2}ytmp4\n`;
    menu += `┃› ${prefix2}shazam\n`;
    menu += `┃› ${prefix2}find\n`;
    menu += `┃› ${prefix2}send\n`;
    menu += `┃› ${prefix2}get\n`;
    menu += `┃› ${prefix2}tomp3\n`;
    menu += `┃› ${prefix2}toaudio\n`;
    menu += `┃› ${prefix2}ytsearch\n`;
    menu += `┗━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    menu += `┏━━━━━✧ STICKER MENU ✧━━━━━━━\n`;
    menu += `┃› ${prefix2}blur\n`;
    menu += `┃› ${prefix2}timage\n`;
    menu += `┃› ${prefix2}sticker\n`;
    menu += `┃› ${prefix2}tgsticker\n`;
    menu += `┃› ${prefix2}meme\n`;
    menu += `┃› ${prefix2}take\n`;
    menu += `┃› ${prefix2}emojimix\n`;
    menu += `┗━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    menu += `┏━━━━━✧ GAME MENU ✧━━━━━━━\n`;
    menu += `┃› ${prefix2}tictactoe\n`;
    menu += `┃› ${prefix2}hangman\n`;
    menu += `┃› ${prefix2}guess\n`;
    menu += `┃› ${prefix2}trivia\n`;
    menu += `┃› ${prefix2}answer\n`;
    menu += `┃› ${prefix2}truth\n`;
    menu += `┃› ${prefix2}dare\n`;
    menu += `┃› ${prefix2}8ball\n`;
    menu += `┗━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    menu += `┏━━━━━✧ GITHUB CMD ✧━━━━━━━\n`;
    menu += `┃› ${prefix2}git\n`;
    menu += `┃› ${prefix2}github\n`;
    menu += `┃› ${prefix2}sc\n`;
    menu += `┃› ${prefix2}script\n`;
    menu += `┃› ${prefix2}repo\n`;
    menu += `┗━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    menu += `┏━━━━━✧ MAKER MENU ✧━━━━━━━\n`;
    menu += `┃› ${prefix2}compliment\n`;
    menu += `┃› ${prefix2}insult\n`;
    menu += `┃› ${prefix2}flirt\n`;
    menu += `┃› ${prefix2}shayari\n`;
    menu += `┃› ${prefix2}goodnight\n`;
    menu += `┃› ${prefix2}roseday\n`;
    menu += `┃› ${prefix2}character\n`;
    menu += `┃› ${prefix2}wasted\n`;
    menu += `┃› ${prefix2}ship\n`;
    menu += `┃› ${prefix2}simp\n`;
    menu += `┃› ${prefix2}stupid\n`;
    menu += `┗━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    menu += `┏━━━━━✧ ANIME MENU ✧━━━━━━━\n`;
    menu += `┃› ${prefix2}neko\n`;
    menu += `┃› ${prefix2}waifu\n`;
    menu += `┃› ${prefix2}loli\n`;
    menu += `┃› ${prefix2}nom\n`;
    menu += `┃› ${prefix2}poke\n`;
    menu += `┃› ${prefix2}cry\n`;
    menu += `┃› ${prefix2}kiss\n`;
    menu += `┃› ${prefix2}pat\n`;
    menu += `┃› ${prefix2}hug\n`;
    menu += `┃› ${prefix2}wink\n`;
    menu += `┃› ${prefix2}facepalm\n`;
    menu += `┗━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    menu += `┏━━━━━✧ TEXT MAKER MENU ✧━━━━━━━\n`;
    menu += `┃› ${prefix2}metallic\n`;
    menu += `┃› ${prefix2}ice\n`;
    menu += `┃› ${prefix2}snow\n`;
    menu += `┃› ${prefix2}impressive\n`;
    menu += `┃› ${prefix2}matrix\n`;
    menu += `┃› ${prefix2}light\n`;
    menu += `┃› ${prefix2}neon\n`;
    menu += `┃› ${prefix2}devil\n`;
    menu += `┃› ${prefix2}purple\n`;
    menu += `┃› ${prefix2}thunder\n`;
    menu += `┃› ${prefix2}leaves\n`;
    menu += `┃› ${prefix2}1917\n`;
    menu += `┃› ${prefix2}arena\n`;
    menu += `┃› ${prefix2}hacker\n`;
    menu += `┃› ${prefix2}sand\n`;
    menu += `┃› ${prefix2}blackpink\n`;
    menu += `┃› ${prefix2}glitch\n`;
    menu += `┃› ${prefix2}fire\n`;
    menu += `┗━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    menu += `┏━━━━━✧ IMAGE EDIT MENU ✧━━━━━━━\n`;
    menu += `┃› ${prefix2}heart\n`;
    menu += `┃› ${prefix2}horny\n`;
    menu += `┃› ${prefix2}circle\n`;
    menu += `┃› ${prefix2}lgbt\n`;
    menu += `┃› ${prefix2}lolice\n`;
    menu += `┃› ${prefix2}stupid\n`;
    menu += `┃› ${prefix2}namecard\n`;
    menu += `┃› ${prefix2}tweet\n`;
    menu += `┃› ${prefix2}ytcomment\n`;
    menu += `┃› ${prefix2}comrade\n`;
    menu += `┃› ${prefix2}gay\n`;
    menu += `┃› ${prefix2}glass\n`;
    menu += `┃› ${prefix2}jail\n`;
    menu += `┃› ${prefix2}passed\n`;
    menu += `┃› ${prefix2}triggered\n`;
    menu += `┗━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    menu += `┏━━━━━✧ 🎄 MERRY CHRISTMAS ✧━━━━━━━\n`;
    menu += `┃✧ Developer: DAVE\n`;
    menu += `┃✧ Bot: DAVE-X\n`;
    menu += `┃✧ Version: v${settings.version}\n`;
    menu += `┗━━━━━━━━━━━━━━━━━━━━━━━━━`;

    return menu;
};

async function loadThumbnail(thumbnailPath) {
    try {
        if (fs.existsSync(thumbnailPath)) {
            return fs.readFileSync(thumbnailPath);
        } else {
            console.log(`Thumbnail not found: ${thumbnailPath}, using fallback`);
            return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
        }
    } catch (error) {
        console.error('Error loading thumbnail:', error);
        return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    }
}

function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "DaveX Menu",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:DaveX Bot\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Bot\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function sendMenuWithStyle(sock, chatId, message, menulist, menustyle, thumbnailBuffer, pushname) {
    const fkontak = createFakeContact(message);
    const botname = "DAVE-X BOT";
    const ownername = pushname;
    const tylorkids = thumbnailBuffer;
    const plink = "https://github.com/gifteddevsmd";

    if (menustyle === '1') {
        await sock.sendMessage(chatId, {
            document: {
                url: "https://i.ibb.co/2W0H9Jq/avatar-contact.png",
            },
            caption: menulist,
            mimetype: "application/zip",
            fileName: `${botname}`,
            fileLength: "9999999",
            contextInfo: {
                externalAdReply: {
                    showAdAttribution: false,
                    title: "",
                    body: "",
                    thumbnail: tylorkids,
                    sourceUrl: plink,
                    mediaType: 1,
                    renderLargerThumbnail: true,
                },
            },
        }, { quoted: fkontak });
    } else if (menustyle === '2') {
        await sock.sendMessage(chatId, { 
            text: menulist 
        }, { quoted: fkontak });
    } else if (menustyle === '3') {
        await sock.sendMessage(chatId, {
            text: menulist,
            contextInfo: {
                externalAdReply: {
                    showAdAttribution: false,
                    title: botname,
                    body: ownername,
                    thumbnail: tylorkids,
                    sourceUrl: plink,
                    mediaType: 1,
                    renderLargerThumbnail: true,
                },
            },
        }, { quoted: fkontak });
    } else if (menustyle === '4') {
        await sock.sendMessage(chatId, {
            image: tylorkids,
            caption: menulist,
        }, { quoted: fkontak });
    } else if (menustyle === '5') {
        let massage = generateWAMessageFromContent(chatId, {
            viewOnceMessage: {
                message: {
                    interactiveMessage: {
                        body: {
                            text: null,            
                        },
                        footer: {
                            text: menulist, 
                        },
                        nativeFlowMessage: {
                            buttons: [{
                                text: null
                            }], 
                        },
                    },
                },
            },
        }, { quoted: fkontak });
        await sock.relayMessage(chatId, massage.message, { messageId: massage.key.id });
    } else if (menustyle === '6') {
        await sock.relayMessage(chatId, {
            requestPaymentMessage: {
                currencyCodeIso4217: 'USD',
                requestFrom: '0@s.whatsapp.net',
                amount1000: '1',
                noteMessage: {
                    extendedTextMessage: {
                        text: menulist,
                        contextInfo: {
                            mentionedJid: [message.key.participant || message.key.remoteJid],
                            externalAdReply: {
                                showAdAttribution: false,
                            },
                        },
                    },
                },
            },
        }, {});
    } else {
        await sock.sendMessage(chatId, { 
            text: menulist 
        }, { quoted: fkontak });
    }
}

async function helpCommand(sock, chatId, message) {
    const pushname = message.pushName || "User"; 
    const menuStyle = getMenuStyle();

    console.log('Menu style:', menuStyle);

    let data = JSON.parse(fs.readFileSync('./data/messageCount.json'));
    
    const fkontak = createFakeContact(message);
    
    const start = Date.now();
    await sock.sendMessage(chatId, { 
        text: 'Loading DaveX menu...' 
    }, { quoted: fkontak });
    const end = Date.now();
    const ping = Math.round((end - start) / 2);

    const uptimeInSeconds = process.uptime();
    const uptimeFormatted = formatTime(uptimeInSeconds);
    const currentMode = data.isPublic ? 'public' : 'private';
    const hostName = detectPlatform();
    
    const menulist = generateMenu(pushname, currentMode, hostName, ping, uptimeFormatted);

    const thumbnailFiles = [
        'menu1.jpg',
        'menu2.jpg', 
        'menu3.jpg',
        'menu4.jpg',
        'menu5.jpg'
    ];
    const randomThumbFile = thumbnailFiles[Math.floor(Math.random() * thumbnailFiles.length)];
    const thumbnailPath = path.join(__dirname, '../assets', randomThumbFile);

    await sock.sendMessage(chatId, {
        react: { text: '📔', key: message.key }
    });

    try {
        const thumbnailBuffer = await loadThumbnail(thumbnailPath);

        await sendMenuWithStyle(sock, chatId, message, menulist, menuStyle, thumbnailBuffer, pushname);

        await sock.sendMessage(chatId, {
            react: { text: '✅', key: message.key }
        });

    } catch (error) {
        console.error('Menu error:', error);
        try {
            await sock.sendMessage(chatId, { 
                text: menulist 
            }, { quoted: fkontak });
        } catch (fallbackError) {
            console.error('Fallback error:', fallbackError);
        }
    }
}

module.exports = helpCommand;