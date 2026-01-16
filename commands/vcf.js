const fs = require('fs');
const path = require('path');

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

async function vcfCommand(sock, chatId, message) {
    const fkontak = createFakeContact(message);

    try {
        // Restrict to groups only
        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, { 
                text: "This command only works in groups." 
            }, { quoted: fkontak });
            return;
        }

        // Get group metadata
        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants || [];

        // Validate group size
        if (participants.length < 2) {
            await sock.sendMessage(chatId, { 
                text: "Group must have at least 2 members." 
            }, { quoted: fkontak });
            return;
        }

        // Generate VCF content
        let vcfContent = '';
        participants.forEach(participant => {
            const phoneNumber = participant.id.split('@')[0];
            const displayName = participant.notify || `User_${phoneNumber}`;

            vcfContent += `BEGIN:VCARD\n` +
                          `VERSION:3.0\n` +
                          `FN:${displayName}\n` +
                          `TEL;TYPE=CELL:+${phoneNumber}\n` +
                          `END:VCARD\n`;
        });

        // Create temp file
        const sanitizedGroupName = groupMetadata.subject.replace(/[^\w]/g, '_');
        const tempDir = path.join(__dirname, '../temp');

        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const vcfPath = path.join(tempDir, `${sanitizedGroupName}.vcf`);
        fs.writeFileSync(vcfPath, vcfContent);

        // Send VCF file
        await sock.sendMessage(chatId, {
            document: fs.readFileSync(vcfPath),
            mimetype: 'text/vcard',
            fileName: `${sanitizedGroupName}.vcf`,
            caption: `Group: ${groupMetadata.subject}\nMembers: ${participants.length}`
        }, { quoted: fkontak });

        // Cleanup
        setTimeout(() => {
            try {
                if (fs.existsSync(vcfPath)) {
                    fs.unlinkSync(vcfPath);
                }
            } catch (cleanupError) {
                // Ignore cleanup errors
            }
        }, 5000);

    } catch (error) {
        console.error('VCF Error:', error.message);
        await sock.sendMessage(chatId, { 
            text: "Failed to generate contacts." 
        }, { quoted: fkontak });
    }
}

module.exports = vcfCommand;