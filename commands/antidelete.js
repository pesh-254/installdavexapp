const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { writeFile, unlink, readdir, stat } = require('fs/promises');

const messageStore = new Map();
const CONFIG_PATH = path.join(__dirname, '../data/antidelete.json');
const TEMP_MEDIA_DIR = path.join(__dirname, '../tmp');

const DEFAULT_CONFIG = {
    enabled: true,
    mode: 'private',
    notifyGroups: true,
    notifyPM: true,
    maxStorageMB: 200,
    cleanupInterval: 60,
    autoCleanup: true,
    excludedChats: [],
    captureMedia: true,
    captureText: true,
    antiViewOnce: true,
    maxMessages: 5000
};

let cleanupInterval = null;
initializeSystem();

function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "DaveX Security",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Security;;;\nFN:DaveX Security\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Security Bot\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

function initializeSystem() {
    ensureTempDir();
    startCleanupInterval();
}

async function ensureTempDir() {
    try {
        await fs.promises.mkdir(TEMP_MEDIA_DIR, { recursive: true });
    } catch (err) {}
}

async function getFolderSizeInMB(folderPath) {
    try {
        const files = await readdir(folderPath);
        let totalSize = 0;
        for (const file of files) {
            const filePath = path.join(folderPath, file);
            try {
                const stats = await stat(filePath);
                if (stats.isFile()) totalSize += stats.size;
            } catch {}
        }
        return totalSize / (1024 * 1024);
    } catch {
        return 0;
    }
}

async function cleanTempFolder() {
    try {
        const config = loadAntideleteConfig();
        const sizeMB = await getFolderSizeInMB(TEMP_MEDIA_DIR);
        if (sizeMB > config.maxStorageMB) {
            const files = await readdir(TEMP_MEDIA_DIR);
            let deletedCount = 0;
            for (const file of files) {
                const filePath = path.join(TEMP_MEDIA_DIR, file);
                try {
                    await unlink(filePath);
                    deletedCount++;
                } catch {}
            }
            return deletedCount;
        }
        return 0;
    } catch {
        return 0;
    }
}

function loadAntideleteConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) {
            saveAntideleteConfig(DEFAULT_CONFIG);
            return DEFAULT_CONFIG;
        }
        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        return { ...DEFAULT_CONFIG, ...config };
    } catch {
        return DEFAULT_CONFIG;
    }
}

function saveAntideleteConfig(config) {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
        return true;
    } catch {
        return false;
    }
}

function startCleanupInterval() {
    const config = loadAntideleteConfig();
    if (cleanupInterval) clearInterval(cleanupInterval);
    cleanupInterval = setInterval(() => {
        cleanTempFolder().catch(() => {});
    }, config.cleanupInterval * 60 * 1000);
}

async function isAuthorized(message) {
    try {
        const { isSudo } = require('../lib/index');
        const senderId = message.key.participant || message.key.remoteJid;
        return message.key.fromMe || await isSudo(senderId);
    } catch {
        return message.key.fromMe;
    }
}

async function handleAntideleteCommand(sock, chatId, message, match) {
    if (!await isAuthorized(message)) {
        const fakeContact = createFakeContact(message);
        return sock.sendMessage(chatId, { 
            text: 'Owner only' 
        }, { quoted: fakeContact });
    }

    const fakeContact = createFakeContact(message);
    const config = loadAntideleteConfig();

    if (!match) {
        return showStatus(sock, chatId, fakeContact, config);
    }

    const command = match.toLowerCase().trim();
    return processCommand(sock, chatId, fakeContact, command, config);
}

async function showStatus(sock, chatId, fakeContact, config) {
    const sizeMB = await getFolderSizeInMB(TEMP_MEDIA_DIR);
    
    const text = `Antidelete: ${config.enabled ? 'ON' : 'OFF'}\n` +
                `Mode: ${config.mode}\n` +
                `Storage: ${sizeMB.toFixed(1)}MB\n` +
                `Messages: ${messageStore.size}\n\n` +
                `Commands: on/off, private, chat, both, exclude, include, clean, stats\n\n` +
                `🎄 Merry Christmas`;
    
    await sock.sendMessage(chatId, { text }, { quoted: fakeContact });
}

async function processCommand(sock, chatId, fakeContact, command, config) {
    let responseText = '';

    switch (command) {
        case 'on':
            config.enabled = true;
            responseText = 'Antidelete ON';
            break;
        case 'off':
            config.enabled = false;
            responseText = 'Antidelete OFF';
            break;
        case 'private':
            config.mode = 'private';
            responseText = 'Mode: Private';
            break;
        case 'chat':
            config.mode = 'chat';
            responseText = 'Mode: Chat';
            break;
        case 'both':
            config.mode = 'both';
            responseText = 'Mode: Both';
            break;
        case 'exclude':
            if (!config.excludedChats.includes(chatId)) {
                config.excludedChats.push(chatId);
                responseText = 'Chat excluded';
            } else {
                responseText = 'Already excluded';
            }
            break;
        case 'include':
            config.excludedChats = config.excludedChats.filter(id => id !== chatId);
            responseText = 'Chat included';
            break;
        case 'clean':
            const deletedCount = await cleanTempFolder();
            responseText = `Cleaned: ${deletedCount} files`;
            break;
        case 'stats':
            const sizeMB = await getFolderSizeInMB(TEMP_MEDIA_DIR);
            responseText = `Stats:\nMessages: ${messageStore.size}\nStorage: ${sizeMB.toFixed(1)}MB\nExcluded: ${config.excludedChats.length}`;
            break;
        default:
            responseText = 'Invalid command';
    }

    if (responseText !== 'Invalid command') {
        saveAntideleteConfig(config);
        startCleanupInterval();
    }

    await sock.sendMessage(chatId, { text: responseText }, { quoted: fakeContact });
}

async function storeMessage(sock, message) {
    try {
        await ensureTempDir();
        const config = loadAntideleteConfig();
        if (!config.enabled) return;

        const chatId = message.key.remoteJid;
        if (config.excludedChats.includes(chatId)) return;
        if (!message.key?.id) return;

        if (messageStore.size >= config.maxMessages) {
            const firstKey = messageStore.keys().next().value;
            const oldMessage = messageStore.get(firstKey);
            messageStore.delete(firstKey);
            if (oldMessage?.mediaPath) {
                unlink(oldMessage.mediaPath).catch(() => {});
            }
        }

        const messageId = message.key.id;
        const sender = message.key.participant || message.key.remoteJid;

        const storedMessage = {
            content: '',
            mediaType: '',
            mediaPath: '',
            sender,
            chatId,
            group: chatId.endsWith('@g.us') ? chatId : null,
            timestamp: Date.now(),
            isViewOnce: false
        };

        await extractMessageContent(message, storedMessage, config);
        
        if (storedMessage.content || storedMessage.mediaType) {
            messageStore.set(messageId, storedMessage);
            
            if (storedMessage.isViewOnce && storedMessage.mediaPath) {
                await handleViewOnceForward(sock, config, storedMessage);
            }
        }

    } catch {}
}

async function extractMessageContent(message, storedMessage, config) {
    try {
        const viewOnceContainer = message.message?.viewOnceMessageV2?.message || 
                               message.message?.viewOnceMessage?.message;
        
        if (viewOnceContainer && config.antiViewOnce) {
            await handleViewOnceMessage(viewOnceContainer, storedMessage);
            return;
        }

        if (config.captureText) {
            if (message.message?.conversation) {
                storedMessage.content = message.message.conversation;
            } else if (message.message?.extendedTextMessage?.text) {
                storedMessage.content = message.message.extendedTextMessage.text;
            }
        }

        if (config.captureMedia) {
            await handleMediaMessage(message, storedMessage);
        }

    } catch {}
}

async function handleViewOnceMessage(viewOnceContainer, storedMessage) {
    try {
        storedMessage.isViewOnce = true;

        if (viewOnceContainer.imageMessage) {
            storedMessage.mediaType = 'image';
            storedMessage.content = viewOnceContainer.imageMessage.caption || '';
            storedMessage.mediaPath = await downloadMedia(
                viewOnceContainer.imageMessage, 
                'image', 
                `${storedMessage.timestamp}_viewonce.jpg`
            );
        } else if (viewOnceContainer.videoMessage) {
            storedMessage.mediaType = 'video';
            storedMessage.content = viewOnceContainer.videoMessage.caption || '';
            storedMessage.mediaPath = await downloadMedia(
                viewOnceContainer.videoMessage, 
                'video', 
                `${storedMessage.timestamp}_viewonce.mp4`
            );
        }
    } catch {}
}

async function handleMediaMessage(message, storedMessage) {
    try {
        const msg = message.message;

        if (msg.imageMessage) {
            storedMessage.mediaType = 'image';
            storedMessage.content = msg.imageMessage.caption || '';
            storedMessage.mediaPath = await downloadMedia(
                msg.imageMessage, 
                'image', 
                `${storedMessage.timestamp}.jpg`
            );
        } else if (msg.stickerMessage) {
            storedMessage.mediaType = 'sticker';
            storedMessage.mediaPath = await downloadMedia(
                msg.stickerMessage, 
                'sticker', 
                `${storedMessage.timestamp}.webp`
            );
        } else if (msg.videoMessage) {
            storedMessage.mediaType = 'video';
            storedMessage.content = msg.videoMessage.caption || '';
            storedMessage.mediaPath = await downloadMedia(
                msg.videoMessage, 
                'video', 
                `${storedMessage.timestamp}.mp4`
            );
        } else if (msg.audioMessage) {
            storedMessage.mediaType = 'audio';
            const mime = msg.audioMessage.mimetype || '';
            const ext = mime.includes('mpeg') ? 'mp3' : (mime.includes('ogg') ? 'ogg' : 'mp3');
            storedMessage.mediaPath = await downloadMedia(
                msg.audioMessage, 
                'audio', 
                `${storedMessage.timestamp}.${ext}`
            );
        } else if (msg.documentMessage) {
            storedMessage.mediaType = 'document';
            storedMessage.content = msg.documentMessage.fileName || 'Document';
            const fileName = msg.documentMessage.fileName || 'file';
            storedMessage.mediaPath = await downloadMedia(
                msg.documentMessage, 
                'document', 
                `${storedMessage.timestamp}_${fileName}`
            );
        }
    } catch {}
}

async function downloadMedia(message, type, fileName) {
    try {
        const stream = await downloadContentFromMessage(message, type);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }
        const filePath = path.join(TEMP_MEDIA_DIR, fileName);
        await writeFile(filePath, buffer);
        return filePath;
    } catch {
        return null;
    }
}

async function handleViewOnceForward(sock, config, storedMessage) {
    try {
        if (!storedMessage.mediaPath || !fs.existsSync(storedMessage.mediaPath)) return;

        const senderName = storedMessage.sender.split('@')[0];
        const mediaOptions = {
            caption: `ViewOnce: @${senderName}`,
            mentions: [storedMessage.sender]
        };

        const targets = getNotificationTargets(sock, storedMessage.chatId, config);
        
        for (const target of targets) {
            try {
                if (storedMessage.mediaType === 'image') {
                    await sock.sendMessage(target, { 
                        image: { url: storedMessage.mediaPath }, 
                        ...mediaOptions 
                    });
                } else if (storedMessage.mediaType === 'video') {
                    await sock.sendMessage(target, { 
                        video: { url: storedMessage.mediaPath }, 
                        ...mediaOptions 
                    });
                }
            } catch {}
        }

        try {
            await unlink(storedMessage.mediaPath);
            messageStore.delete(storedMessage.timestamp);
        } catch {}
    } catch {}
}

function getNotificationTargets(sock, chatId, config) {
    const targets = [];
    const ownerNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    
    if (config.mode === 'private' || config.mode === 'both') {
        targets.push(ownerNumber);
    }
    
    if ((config.mode === 'chat' || config.mode === 'both') && chatId !== ownerNumber) {
        targets.push(chatId);
    }
    
    return targets;
}

async function handleMessageRevocation(sock, revocationMessage) {
    try {
        const config = loadAntideleteConfig();
        if (!config.enabled) return;

        const messageId = revocationMessage.message?.protocolMessage?.key?.id;
        if (!messageId) return;

        const deletedBy = revocationMessage.participant || revocationMessage.key.participant || revocationMessage.key.remoteJid;
        const ownerNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';

        if (deletedBy.includes(sock.user.id) || deletedBy === ownerNumber) return;

        const original = messageStore.get(messageId);
        if (!original) return;

        if (config.excludedChats.includes(original.chatId)) {
            messageStore.delete(messageId);
            return;
        }

        const targets = getNotificationTargets(sock, original.chatId, config);
        if (targets.length === 0) return;

        await sendDeletionNotification(sock, original, deletedBy, targets);
        cleanupStoredMessage(messageId, original);

    } catch {}
}

function cleanupStoredMessage(messageId, original) {
    messageStore.delete(messageId);
    if (original.mediaPath && fs.existsSync(original.mediaPath)) {
        unlink(original.mediaPath).catch(() => {});
    }
}

async function sendDeletionNotification(sock, original, deletedBy, targets) {
    try {
        const senderName = original.sender.split('@')[0];
        const deleterName = deletedBy.split('@')[0];
        
        let groupName = '';
        if (original.group) {
            try {
                const metadata = await sock.groupMetadata(original.group);
                groupName = metadata.subject;
            } catch {
                groupName = '';
            }
        }

        const time = new Date(original.timestamp).toLocaleString('en-US', {
            hour12: true, 
            hour: '2-digit', 
            minute: '2-digit',
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric'
        });

        let text = `Deleted by @${deleterName}\n`;
        text += `From @${senderName}\n`;
        text += `Time: ${time}\n`;
        if (groupName) text += `Group: ${groupName}\n`;
        if (original.isViewOnce) text += `Type: View Once\n`;
        if (original.content) text += `Message: ${original.content.substring(0, 100)}${original.content.length > 100 ? '...' : ''}`;

        const textMessage = {
            text,
            mentions: [deletedBy, original.sender]
        };

        for (const target of targets) {
            try {
                await sock.sendMessage(target, textMessage);
            } catch {}
        }

        if (original.mediaType && original.mediaPath && fs.existsSync(original.mediaPath)) {
            await sendMediaNotification(sock, original, targets);
        }

    } catch {}
}

async function sendMediaNotification(sock, original, targets) {
    const senderName = original.sender.split('@')[0];
    const mediaOptions = {
        caption: `Deleted ${original.mediaType} from @${senderName}`,
        mentions: [original.sender]
    };

    for (const target of targets) {
        try {
            switch (original.mediaType) {
                case 'image':
                    await sock.sendMessage(target, {
                        image: { url: original.mediaPath },
                        ...mediaOptions
                    });
                    break;
                case 'sticker':
                    await sock.sendMessage(target, {
                        sticker: { url: original.mediaPath },
                        ...mediaOptions
                    });
                    break;
                case 'video':
                    await sock.sendMessage(target, {
                        video: { url: original.mediaPath },
                        ...mediaOptions
                    });
                    break;
                case 'audio':
                    await sock.sendMessage(target, {
                        audio: { url: original.mediaPath },
                        mimetype: 'audio/mpeg',
                        ptt: false,
                        ...mediaOptions
                    });
                    break;
                case 'document':
                    await sock.sendMessage(target, {
                        document: { url: original.mediaPath },
                        fileName: path.basename(original.mediaPath),
                        ...mediaOptions
                    });
                    break;
            }
        } catch {}
    }
}

module.exports = {
    handleAntideleteCommand,
    handleMessageRevocation,
    storeMessage,
    cleanTempFolder
};