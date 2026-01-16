const fs = require('fs');
const path = require('path');
const isAdmin = require('../lib/isAdmin');

const configPath = path.join(__dirname, '..', 'data', 'antimention.json');

function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "KOLOLI",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:KOLOLI\nitem1.TEL;waid=${message?.key?.participant?.split('@')[0] || message?.key?.remoteJid?.split('@')[0] || '0'}:${message?.key?.participant?.split('@')[0] || message?.key?.remoteJid?.split('@')[0] || '0'}\nitem1.X-ABLabel:Phone\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

function initConfig() {
    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify({}, null, 2));
    }
    return JSON.parse(fs.readFileSync(configPath));
}

function saveConfig(config) {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function getGroupConfig(chatId) {
    const config = initConfig();
    return config[chatId] || { enabled: false, action: 'delete', maxMentions: 5 };
}

function setGroupConfig(chatId, groupConfig) {
    const config = initConfig();
    config[chatId] = groupConfig;
    saveConfig(config);
}

async function antimentionCommand(sock, chatId, message, senderId) {
    try {
        const fake = createFakeContact(message);
        const isSenderAdmin = await isAdmin(sock, chatId, senderId);

        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { text: '❌ For Group Admins Only' }, { quoted: fake });
            return;
        }

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = text.trim().split(' ').slice(1);
        const action = args[0]?.toLowerCase();

        const groupConfig = getGroupConfig(chatId);

        if (!action) {
            const usage = `@ *ANTIMENTION SETUP*\n\n.antimention on\n.antimention set delete | kick | warn\n.antimention limit [number]\n.antimention off\n.antimention get`;
            await sock.sendMessage(chatId, { text: usage }, { quoted: fake });
            return;
        }

        switch (action) {
            case 'on':
                groupConfig.enabled = true;
                setGroupConfig(chatId, groupConfig);
                await sock.sendMessage(chatId, { text: '@ Antimention has been turned ON - Blocking mentions...' }, { quoted: fake });
                break;

            case 'off':
                groupConfig.enabled = false;
                setGroupConfig(chatId, groupConfig);
                await sock.sendMessage(chatId, { text: '@ Antimention has been turned OFF' }, { quoted: fake });
                break;

            case 'set':
                const setAction = args[1]?.toLowerCase();
                if (!['delete', 'kick', 'warn'].includes(setAction)) {
                    await sock.sendMessage(chatId, { text: '❌ Invalid action. Choose delete, kick, or warn.' }, { quoted: fake });
                    return;
                }
                groupConfig.action = setAction;
                groupConfig.enabled = true;
                setGroupConfig(chatId, groupConfig);
                await sock.sendMessage(chatId, { text: `@ Antimention action set to ${setAction}` }, { quoted: fake });
                break;

            case 'limit':
                const limit = parseInt(args[1]);
                if (isNaN(limit) || limit < 1) {
                    await sock.sendMessage(chatId, { text: '❌ Invalid limit. Use a number greater than 0.' }, { quoted: fake });
                    return;
                }
                groupConfig.maxMentions = limit;
                setGroupConfig(chatId, groupConfig);
                await sock.sendMessage(chatId, { text: `@ Antimention limit set to ${limit} mentions` }, { quoted: fake });
                break;

            case 'get':
                const statusText = `@ *Antimention Configuration*\nStatus: ${groupConfig.enabled ? 'ON' : 'OFF'}\nAction: ${groupConfig.action || 'delete'}\nMax Mentions: ${groupConfig.maxMentions || 5}`;
                await sock.sendMessage(chatId, { text: statusText }, { quoted: fake });
                break;

            default:
                await sock.sendMessage(chatId, { text: '❌ Invalid command. Use .antimention on/off/set/limit/get' }, { quoted: fake });
        }
    } catch (error) {
        console.error('Error in antimention command:', error);
    }
}

async function handleMentionDetection(sock, chatId, message, senderId) {
    const groupConfig = getGroupConfig(chatId);
    if (!groupConfig.enabled) return;

    const mentions = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const maxMentions = groupConfig.maxMentions || 5;

    if (mentions.length <= maxMentions) return;

    const senderIsAdmin = await isAdmin(sock, chatId, senderId);
    if (senderIsAdmin) return;

    const quotedMessageId = message.key.id;
    const quotedParticipant = message.key.participant || senderId;

    try {
        switch (groupConfig.action) {
            case 'delete':
                await sock.sendMessage(chatId, {
                    delete: { remoteJid: chatId, fromMe: false, id: quotedMessageId, participant: quotedParticipant }
                });
                break;

            case 'warn':
                const fake = createFakeContact(message);
                await sock.sendMessage(chatId, {
                    text: `⚠️ Warning! @${senderId.split('@')[0]}, too many mentions (max ${maxMentions}) is not allowed here.`,
                    mentions: [senderId]
                }, { quoted: fake });
                break;

            case 'kick':
                await sock.sendMessage(chatId, {
                    delete: { remoteJid: chatId, fromMe: false, id: quotedMessageId, participant: quotedParticipant }
                });
                await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
                break;
        }
    } catch (error) {
        console.error('Failed to enforce antimention action:', error);
    }
}

module.exports = {
    antimentionCommand,
    handleMentionDetection
};
