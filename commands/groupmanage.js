const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "DaveX Group",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Group;;;\nFN:DaveX Group\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Group Bot\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function ensureGroupAndAdmin(sock, chatId, senderId) {
    const isGroup = chatId.endsWith('@g.us');
    if (!isGroup) {
        return { ok: false };
    }
    const isAdmin = require('../lib/isAdmin');
    const adminStatus = await isAdmin(sock, chatId, senderId);
    if (!adminStatus.isBotAdmin) {
        return { ok: false };
    }
    if (!adminStatus.isSenderAdmin) {
        return { ok: false };
    }
    return { ok: true };
}

async function setGroupDescription(sock, chatId, senderId, text, message) {
    const fakeContact = createFakeContact(message);
    const check = await ensureGroupAndAdmin(sock, chatId, senderId);
    if (!check.ok) {
        await sock.sendMessage(chatId, { text: 'Group admins only' }, { quoted: fakeContact });
        return;
    }
    const desc = (text || '').trim();
    if (!desc) {
        await sock.sendMessage(chatId, { text: 'Usage: .setgdesc <text>' }, { quoted: fakeContact });
        return;
    }
    try {
        await sock.groupUpdateDescription(chatId, desc);
        await sock.sendMessage(chatId, { text: 'Description updated' }, { quoted: fakeContact });
    } catch (e) {
        await sock.sendMessage(chatId, { text: 'Failed to update' }, { quoted: fakeContact });
    }
}

async function setGroupName(sock, chatId, senderId, text, message) {
    const fakeContact = createFakeContact(message);
    const check = await ensureGroupAndAdmin(sock, chatId, senderId);
    if (!check.ok) {
        await sock.sendMessage(chatId, { text: 'Group admins only' }, { quoted: fakeContact });
        return;
    }
    const name = (text || '').trim();
    if (!name) {
        await sock.sendMessage(chatId, { text: 'Usage: .setgname <name>' }, { quoted: fakeContact });
        return;
    }
    try {
        await sock.groupUpdateSubject(chatId, name);
        await sock.sendMessage(chatId, { text: 'Group name updated' }, { quoted: fakeContact });
    } catch (e) {
        await sock.sendMessage(chatId, { text: 'Failed to update' }, { quoted: fakeContact });
    }
}

async function setGroupPhoto(sock, chatId, senderId, message) {
    const fakeContact = createFakeContact(message);
    const check = await ensureGroupAndAdmin(sock, chatId, senderId);
    if (!check.ok) {
        await sock.sendMessage(chatId, { text: 'Group admins only' }, { quoted: fakeContact });
        return;
    }

    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const imageMessage = quoted?.imageMessage || quoted?.stickerMessage;
    if (!imageMessage) {
        await sock.sendMessage(chatId, { text: 'Reply to image/sticker' }, { quoted: fakeContact });
        return;
    }
    try {
        const tmpDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

        const stream = await downloadContentFromMessage(imageMessage, 'image');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        const imgPath = path.join(tmpDir, `gpp_${Date.now()}.jpg`);
        fs.writeFileSync(imgPath, buffer);

        await sock.updateProfilePicture(chatId, { url: imgPath });
        try { fs.unlinkSync(imgPath); } catch (_) {}
        await sock.sendMessage(chatId, { text: 'Group photo updated' }, { quoted: fakeContact });
    } catch (e) {
        await sock.sendMessage(chatId, { text: 'Failed to update photo' }, { quoted: fakeContact });
    }
}

module.exports = {
    setGroupDescription,
    setGroupName,
    setGroupPhoto
};