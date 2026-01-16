// Fake contact creator 😜
function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "DaveX Group Cleaner",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:X;Dave;;;\nFN:DaveX Bot\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:BOT\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function kickAllCommand(sock, chatId, message) {
    const fkontak = createFakeContact(message);
    
    try {
        const isOwner = message.key.fromMe;
        if (!isOwner) {
            await sock.sendMessage(chatId, { 
                text: 'This command is owner only.'
            }, { quoted: fkontak });
            return;
        }

        // Get group metadata
        const chat = await sock.groupMetadata(chatId).catch(() => null);
        if (!chat) {
            await sock.sendMessage(chatId, { 
                text: 'This command works in groups only.'
            }, { quoted: fkontak });
            return;
        }

        // Check if user is group admin
        const isAdmin = chat.participants.find(
            p => p.id === (message.key.participant || message.key.remoteJid)
        )?.admin;
        if (!isAdmin) {
            await sock.sendMessage(chatId, { 
                text: 'Group admin required for this command.'
            }, { quoted: fkontak });
            return;
        }

        // Get all participants except the bot and the command sender
        const participants = chat.participants.filter(p => {
            if (p.id.includes(sock.user.id.split(':')[0])) return false; // exclude bot
            if (p.id === (message.key.participant || message.key.remoteJid)) return false; // exclude sender
            return true;
        });

        if (participants.length === 0) {
            await sock.sendMessage(chatId, { 
                text: 'No members to remove.'
            }, { quoted: fkontak });
            return;
        }

        // Warning message
        const warningMessage = `GROUP CLEANING STARTING\n\nRemoving all members in 3 seconds:\n\n${participants.map((p, i) => `${i + 1}. @${p.id.split('@')[0]}`).join('\n')}\n\nThis action cannot be undone.`;

        await sock.sendMessage(chatId, { 
            text: warningMessage,
            mentions: participants.map(p => p.id)
        }, { quoted: fkontak });

        // Wait 3 seconds before kicking
        await new Promise(resolve => setTimeout(resolve, 3000));

        try {
            // Remove all participants
            await sock.groupParticipantsUpdate(
                chatId,
                participants.map(p => p.id),
                'remove'
            );

            await sock.sendMessage(chatId, { 
                text: `Cleaning complete: ${participants.length} member(s) removed.`
            }, { quoted: fkontak });

            console.log(`Kick All Complete: ${participants.length} members removed`);
        } catch (error) {
            console.error('Failed to remove all members:', error);
            await sock.sendMessage(chatId, { 
                text: `Failed to remove members. Error: ${error.message}`
            }, { quoted: fkontak });
        }

    } catch (error) {
        console.error('Error in kickAllCommand:', error);
        await sock.sendMessage(chatId, { 
            text: `Command execution failed. Error: ${error.message}`
        }, { quoted: fkontak });
    }
}

module.exports = kickAllCommand;