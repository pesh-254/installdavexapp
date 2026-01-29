import isAdmin from '../lib/isAdmin.js';

export default {
    name: 'antitelegramlink',
    description: 'Toggle anti Telegram link',
    adminOnly: true,
    async execute(msg, { sock, args }) {
        const remoteJid = msg.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) return sock.sendMessage(remoteJid, { text: '❌ Group only!' });
        
        const status = args[0]?.toLowerCase();
        if (status === 'on') {
            global.antiTelegramLink = global.antiTelegramLink || {};
            global.antiTelegramLink[remoteJid] = true;
            return sock.sendMessage(remoteJid, { text: '✅ Anti Telegram link enabled!' });
        } else if (status === 'off') {
            if (global.antiTelegramLink) delete global.antiTelegramLink[remoteJid];
            return sock.sendMessage(remoteJid, { text: '✅ Anti Telegram link disabled!' });
        } else {
            return sock.sendMessage(remoteJid, { text: 'Usage: antitelegramlink on/off' });
        }
    }
};