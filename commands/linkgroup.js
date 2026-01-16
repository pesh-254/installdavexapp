function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "DaveX Group Admin",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:X;Dave;;;\nFN:DaveX Bot\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:BOT\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function linkgroupCommand(sock, chatId, message) {
    const fkontak = createFakeContact(message);

    // Check if it's a group
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { 
            text: 'This command only works in groups.'
        }, { quoted: fkontak });
        return;
    }

    try {
        // Get sender ID from message
        const senderId = message.key.participant || message.key.remoteJid;
        
        // Check if user is owner
        const isOwner = message.key.fromMe;
        
        if (!isOwner) {
            const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

            if (!isBotAdmin) {
                await sock.sendMessage(chatId, { 
                    text: 'Bot needs admin permissions to get group link.'
                }, { quoted: fkontak });
                return;
            }

            if (!isSenderAdmin) {
                await sock.sendMessage(chatId, { 
                    text: 'This command requires admin privileges.'
                }, { quoted: fkontak });
                return;
            }
        }

        // Get invite code and group metadata
        const code = await sock.groupInviteCode(chatId);
        const metadata = await sock.groupMetadata(chatId);

        // Send the link
        await sock.sendMessage(chatId, { 
            text: `🔗 *Group Invite Link*\n\nhttps://chat.whatsapp.com/${code}\n\n📌 Group: ${metadata.subject}\n👥 Members: ${metadata.participants.length}\n\n- DAVE X`
        }, { quoted: fkontak });

    } catch (error) {
        console.error('Error in linkgroup command:', error);
        
        let errorMsg = 'Failed to get group link.';
        
        if (error.message?.includes('not-authorized') || error.message?.includes('forbidden')) {
            errorMsg = 'Bot needs admin permissions to get group link.';
        }
        
        await sock.sendMessage(chatId, { 
            text: errorMsg
        }, { quoted: fkontak });
    }
}

module.exports = linkgroupCommand;