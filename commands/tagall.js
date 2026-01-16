const isAdmin = require('../lib/isAdmin');

function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "Davex Mention",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Mention;;;\nFN:Davex Group Mention\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Mention Bot\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function tagAllCommand(sock, chatId, senderId, message) {
    const fakeContact = createFakeContact(message);
    
    try {
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
        
        if (!isSenderAdmin && !isBotAdmin) {
            await sock.sendMessage(chatId, {
                text: 'Admin authorization required'
            }, { quoted: fakeContact });
            return;
        }

        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants;

        if (!participants || participants.length === 0) {
            await sock.sendMessage(chatId, { 
                text: 'No group participants available' 
            }, { quoted: fakeContact });
            return;
        }

        let profilePictureUrl = null;
        try {
            const ppUrl = await sock.profilePictureUrl(chatId, 'image');
            profilePictureUrl = ppUrl;
        } catch (error) {
            console.log('Profile image unavailable:', error.message);
        }

        let textContent = `GROUP PARTICIPANT MENTION\n\n`;
        textContent += `Group: ${groupMetadata.subject}\n`;
        textContent += `Participant count: ${participants.length}\n`;
        textContent += `Group established: ${new Date(groupMetadata.creation * 1000).toLocaleDateString()}\n\n`;
        textContent += `Participant listing:\n\n`;

        participants.forEach((participant, index) => {
            const number = (index + 1).toString().padStart(2, '0');
            const username = participant.id.split('@')[0];
            const displayName = participant.name || participant.notify || username;
            const adminIndicator = participant.admin ? '[ADMIN]' : '';
            
            textContent += `${number}. @${username}${adminIndicator}\n`;
        });

        const messageOptions = {
            text: textContent,
            mentions: participants.map(p => p.id)
        };

        if (profilePictureUrl) {
            try {
                await sock.sendMessage(chatId, {
                    image: { url: profilePictureUrl },
                    caption: textContent,
                    mentions: participants.map(p => p.id)
                }, { quoted: fakeContact });
                return;
            } catch (imageError) {
                console.log('Image delivery failed:', imageError.message);
                await sock.sendMessage(chatId, messageOptions, { quoted: fakeContact });
            }
        } else {
            await sock.sendMessage(chatId, messageOptions, { quoted: fakeContact });
        }

    } catch (error) {
        console.error('Tag command error:', error);
        await sock.sendMessage(chatId, { 
            text: 'Mention operation unsuccessful' 
        }, { quoted: fakeContact });
    }
}

module.exports = tagAllCommand;