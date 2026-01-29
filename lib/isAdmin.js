
async function isAdmin(sock, chatId, senderId) {
    try {
        const groupMetadata = await sock.groupMetadata(chatId).catch(() => null);
        if (!groupMetadata) return { isSenderAdmin: false, isBotAdmin: false };
        
        const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const normalizedSenderId = senderId.split('@')[0] + '@s.whatsapp.net';
        
        const participant = groupMetadata.participants.find(p => p.id.split('@')[0] === senderId.split('@')[0]);
        const bot = groupMetadata.participants.find(p => p.id.split('@')[0] === botId.split('@')[0]);
        
        const isBotAdmin = bot && (bot.admin === 'admin' || bot.admin === 'superadmin');
        const isSenderAdmin = participant && (participant.admin === 'admin' || participant.admin === 'superadmin');

        return { isSenderAdmin: !!isSenderAdmin, isBotAdmin: !!isBotAdmin };
    } catch (error) {
        return { isSenderAdmin: false, isBotAdmin: false };
    }
}

export default isAdmin;
