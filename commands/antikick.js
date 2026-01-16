const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'data', 'antikick.json');

function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "status@broadcast",
            fromMe: false,
            id: "DAVE"
        },
        message: {
            contactMessage: {
                displayName: "DAVE",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:DAVE\nitem1.TEL;waid=${message?.key?.participant?.split('@')[0] || '0'}:${message?.key?.participant?.split('@')[0] || '0'}\nitem1.X-ABLabel:Phone\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

function initConfig() {
    try {
        if (!fs.existsSync(configPath)) {
            fs.writeFileSync(configPath, JSON.stringify({}, null, 2));
        }
        return JSON.parse(fs.readFileSync(configPath));
    } catch (error) {
        return {};
    }
}

function saveConfig(config) {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function getGroupConfig(chatId) {
    const config = initConfig();
    return config[chatId] || { enabled: false };
}

function setGroupConfig(chatId, groupConfig) {
    const config = initConfig();
    config[chatId] = groupConfig;
    saveConfig(config);
}

async function antikickCommand(sock, chatId, message, senderId, isSenderAdmin) {
    try {
        const fake = createFakeContact(message);

        if (!isSenderAdmin && !message.key.fromMe) {
            await sock.sendMessage(chatId, { text: '❌ For Group Admins Only' }, { quoted: fake });
            return;
        }

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = text.trim().split(' ').slice(1);
        const action = args[0]?.toLowerCase();

        const groupConfig = getGroupConfig(chatId);

        if (!action) {
            const usage = `🛡️ *ANTIKICK / ANTIREMOVE SETUP*\n\n.antikick on - Re-add kicked members\n.antikick off - Disable\n.antikick get - Check status`;
            await sock.sendMessage(chatId, { text: usage }, { quoted: fake });
            return;
        }

        switch (action) {
            case 'on':
                groupConfig.enabled = true;
                setGroupConfig(chatId, groupConfig);
                await sock.sendMessage(chatId, { text: '🛡️ Antikick has been turned ON - Kicked members will be re-added!' }, { quoted: fake });
                break;

            case 'off':
                groupConfig.enabled = false;
                setGroupConfig(chatId, groupConfig);
                await sock.sendMessage(chatId, { text: '🛡️ Antikick has been turned OFF' }, { quoted: fake });
                break;

            case 'get':
                const statusText = `🛡️ *Antikick Configuration*\nStatus: ${groupConfig.enabled ? 'ON' : 'OFF'}`;
                await sock.sendMessage(chatId, { text: statusText }, { quoted: fake });
                break;

            default:
                await sock.sendMessage(chatId, { text: '❌ Invalid command. Use .antikick on/off/get' }, { quoted: fake });
        }
    } catch (error) {
        console.error('Error in antikick command:', error);
    }
}

async function handleAntikick(sock, chatId, participants) {
    const groupConfig = getGroupConfig(chatId);
    if (!groupConfig.enabled) return false;

    try {
        for (const participant of participants) {
            try {
                await sock.groupParticipantsUpdate(chatId, [participant], 'add');
                console.log(`[ANTIKICK] Re-added ${participant} to ${chatId}`);
            } catch (addError) {
                console.log(`[ANTIKICK] Could not re-add ${participant}: ${addError.message}`);
            }
        }

        await sock.sendMessage(chatId, {
            text: `🛡️ *Antikick Active*\n\nAttempted to re-add removed member(s).\nDisable with .antikick off`,
        });

        return true;
    } catch (error) {
        console.error('Error in handleAntikick:', error);
        return false;
    }
}

module.exports = {
    antikickCommand,
    handleAntikick,
    getGroupConfig
};
