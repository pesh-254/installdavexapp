const { getBotName, setBotName, getMenuImage, setMenuImage, getConfig, updateConfig } = require('../lib/botConfig');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "status@broadcast",
            fromMe: false,
            id: "KOLOLI-BOT"
        },
        message: {
            contactMessage: {
                displayName: "KOLOLI",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:KOLOLI\nitem1.TEL;waid=${message?.key?.participant?.split('@')[0] || '0'}:${message?.key?.participant?.split('@')[0] || '0'}\nitem1.X-ABLabel:Phone\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function setbotconfigCommand(sock, chatId, message) {
    try {
        const fake = createFakeContact(message);

        if (!message.key.fromMe) {
            await sock.sendMessage(chatId, { text: '❌ This command is only available for the owner!' }, { quoted: fake });
            return;
        }

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = text.trim().split(' ').slice(1);
        const action = args[0]?.toLowerCase();

        if (!action) {
            const config = getConfig();
            const usage = `⚙️ *BOT CONFIGURATION*\n\n` +
                `Current Settings:\n` +
                `• Bot Name: ${config.botName}\n` +
                `• Menu Image: ${config.menuImage ? 'Set' : 'Not set'}\n` +
                `• Antidelete Private: ${config.antideletePrivate ? 'ON' : 'OFF'}\n\n` +
                `Commands:\n` +
                `.setbotname <name> - Set bot name\n` +
                `.setmenuimage - Reply to image to set menu image\n` +
                `.botconfig get - View current config`;
            await sock.sendMessage(chatId, { text: usage }, { quoted: fake });
            return;
        }

        if (action === 'get') {
            const config = getConfig();
            const statusText = `⚙️ *Bot Configuration*\n\n` +
                `• Bot Name: ${config.botName}\n` +
                `• Owner Name: ${config.ownerName}\n` +
                `• Menu Image: ${config.menuImage ? '✅ Set' : '❌ Not set'}\n` +
                `• Antidelete Private: ${config.antideletePrivate ? 'ON' : 'OFF'}`;
            await sock.sendMessage(chatId, { text: statusText }, { quoted: fake });
        }
    } catch (error) {
        console.error('Error in setbotconfig command:', error);
    }
}

async function setbotnameCommand(sock, chatId, message) {
    try {
        const fake = createFakeContact(message);

        if (!message.key.fromMe) {
            await sock.sendMessage(chatId, { text: '❌ This command is only available for the owner!' }, { quoted: fake });
            return;
        }

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const name = text.split(' ').slice(1).join(' ').trim();

        if (!name) {
            await sock.sendMessage(chatId, { text: '❌ Please provide a bot name!\n\nUsage: .setbotname KOLOLI' }, { quoted: fake });
            return;
        }

        setBotName(name);
        await sock.sendMessage(chatId, { text: `✅ Bot name changed to: *${name}*` }, { quoted: fake });
    } catch (error) {
        console.error('Error in setbotname command:', error);
    }
}

async function setmenuimageCommand(sock, chatId, message) {
    try {
        const fake = createFakeContact(message);

        if (!message.key.fromMe) {
            await sock.sendMessage(chatId, { text: '❌ This command is only available for the owner!' }, { quoted: fake });
            return;
        }

        const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!quotedMessage?.imageMessage) {
            await sock.sendMessage(chatId, { text: '❌ Please reply to an image to set as menu image!' }, { quoted: fake });
            return;
        }

        try {
            const stream = await downloadContentFromMessage(quotedMessage.imageMessage, 'image');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            const imagePath = path.join(__dirname, '..', 'assets', 'menuimage.jpg');
            fs.writeFileSync(imagePath, buffer);

            setMenuImage(imagePath);
            await sock.sendMessage(chatId, { text: '✅ Menu image has been updated!' }, { quoted: fake });
        } catch (downloadError) {
            await sock.sendMessage(chatId, { text: `❌ Failed to download image: ${downloadError.message}` }, { quoted: fake });
        }
    } catch (error) {
        console.error('Error in setmenuimage command:', error);
    }
}

module.exports = {
    setbotconfigCommand,
    setbotnameCommand,
    setmenuimageCommand
};
