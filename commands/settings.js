const fs = require('fs');

function createFakeContact(message) {
    const phone = message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0];
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "DAVE-X",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Dave-X;;;\nFN:DAVE-X\nTEL;waid=${phone}:${phone}\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

function readJsonSafe(path, fallback) {
    try {
        const txt = fs.readFileSync(path, 'utf8');
        return JSON.parse(txt);
    } catch (_) {
        return fallback;
    }
}

async function settingsCommand(sock, chatId, message) {
    const fkontak = createFakeContact(message);
    
    try {
        // Owner-only
        if (!message.key.fromMe) {
            await sock.sendMessage(chatId, { text: 'Owner only.' }, { quoted: fkontak });
            return;
        }

        const isGroup = chatId.endsWith('@g.us');
        const dataDir = './data';

        const mode = readJsonSafe(`${dataDir}/messageCount.json`, { isPublic: true });
        const autoStatus = readJsonSafe(`${dataDir}/autoStatus.json`, { enabled: false });
        const autoread = readJsonSafe(`${dataDir}/autoread.json`, { enabled: false });
        const autotyping = readJsonSafe(`${dataDir}/autotyping.json`, { enabled: false });
        const pmblocker = readJsonSafe(`${dataDir}/pmblocker.json`, { enabled: false });
        const anticall = readJsonSafe(`${dataDir}/anticall.json`, { enabled: false });
        const userGroupData = readJsonSafe(`${dataDir}/userGroupData.json`, {
            antilink: {}, antibadword: {}, welcome: {}, goodbye: {}, chatbot: {}, antitag: {}
        });
        const autoReaction = Boolean(userGroupData.autoReaction);

        // Per-group features
        const groupId = isGroup ? chatId : null;
        const antilinkOn = groupId ? Boolean(userGroupData.antilink && userGroupData.antilink[groupId]) : false;
        const antibadwordOn = groupId ? Boolean(userGroupData.antibadword && userGroupData.antibadword[groupId]) : false;
        const welcomeOn = groupId ? Boolean(userGroupData.welcome && userGroupData.welcome[groupId]) : false;
        const goodbyeOn = groupId ? Boolean(userGroupData.goodbye && userGroupData.goodbye[groupId]) : false;
        const chatbotOn = groupId ? Boolean(userGroupData.chatbot && userGroupData.chatbot[groupId]) : false;
        const antitagCfg = groupId ? (userGroupData.antitag && userGroupData.antitag[groupId]) : null;

        const lines = [];
        lines.push('DAVE-X SETTINGS');
        lines.push('');
        lines.push(`Mode: ${mode.isPublic ? 'Public' : 'Private'}`);
        lines.push(`Auto Status: ${autoStatus.enabled ? 'ON' : 'OFF'}`);
        lines.push(`Autoread: ${autoread.enabled ? 'ON' : 'OFF'}`);
        lines.push(`Autotyping: ${autotyping.enabled ? 'ON' : 'OFF'}`);
        lines.push(`PM Blocker: ${pmblocker.enabled ? 'ON' : 'OFF'}`);
        lines.push(`Anticall: ${anticall.enabled ? 'ON' : 'OFF'}`);
        lines.push(`Auto Reaction: ${autoReaction ? 'ON' : 'OFF'}`);
        
        if (groupId) {
            lines.push('');
            lines.push(`Group: ${groupId}`);
            if (antilinkOn) {
                const al = userGroupData.antilink[groupId];
                lines.push(`Antilink: ON (${al.action || 'delete'})`);
            } else {
                lines.push('Antilink: OFF');
            }
            if (antibadwordOn) {
                const ab = userGroupData.antibadword[groupId];
                lines.push(`Antibadword: ON (${ab.action || 'delete'})`);
            } else {
                lines.push('Antibadword: OFF');
            }
            lines.push(`Welcome: ${welcomeOn ? 'ON' : 'OFF'}`);
            lines.push(`Goodbye: ${goodbyeOn ? 'ON' : 'OFF'}`);
            lines.push(`Chatbot: ${chatbotOn ? 'ON' : 'OFF'}`);
            if (antitagCfg && antitagCfg.enabled) {
                lines.push(`Antitag: ON (${antitagCfg.action || 'delete'})`);
            } else {
                lines.push('Antitag: OFF');
            }
        }

        await sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: fkontak });

    } catch (error) {
        console.error('Settings error:', error);
        await sock.sendMessage(chatId, { text: 'Failed to read settings.' }, { quoted: fkontak });
    }
}

module.exports = settingsCommand;