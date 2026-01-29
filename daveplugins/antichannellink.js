import isAdmin from '../lib/isAdmin.js';

export default {
    name: 'antichannellink',
    description: 'Toggle anti WhatsApp channel link',
    adminOnly: true,
    async execute(msg, { sock, args }) {
        const remoteJid = msg.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) return sock.sendMessage(remoteJid, { text: '❌ Group only!' });
        
        const status = args[0]?.toLowerCase();
        if (status === 'on') {
            global.antiChannelLink = global.antiChannelLink || {};
            global.antiChannelLink[remoteJid] = true;
            return sock.sendMessage(remoteJid, { text: '✅ Anti WhatsApp Channel link enabled!' });
        } else if (status === 'off') {
            if (global.antiChannelLink) delete global.antiChannelLink[remoteJid];
            return sock.sendMessage(remoteJid, { text: '✅ Anti WhatsApp Channel link disabled!' });
        } else {
            return sock.sendMessage(remoteJid, { text: 'Usage: antichannellink on/off' });
        }
    }
};