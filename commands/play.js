const fs = require("fs");
const axios = require('axios');
const yts = require('yt-search');
const path = require('path');
const fetch = require('node-fetch');

// Added fakeContact function
function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "Davex Music",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Music;;;\nFN:Davex Music Player\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Music Bot\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function songCommand(sock, chatId, message) {
    try { 
        await sock.sendMessage(chatId, {
            react: { text: '🎼', key: message.key }
        });         

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const parts = text.split(' ');
        const query = parts.slice(1).join(' ').trim();

        if (!query) {
            return await sock.sendMessage(chatId, { 
                text: '🎵 Provide a song name!\nExample:.song Not Like Us' 
            }, { quoted: message });
        }

        if (query.length > 100) {
            return await sock.sendMessage(chatId, { 
                text: `📝 Song name too long! Max 100 chars.` 
            }, { quoted: message });
        }

        const searchResult = await (await yts(`${query} official`)).videos[0];
        if (!searchResult) {
            return sock.sendMessage(chatId, { 
                text: "😕 Couldn't find that song. Try another one!" 
            }, { quoted: message });
        }

        const video = searchResult;
        const apiUrl = `https://apiskeith.vercel.app/download/audio?url=${encodeURIComponent(video.url)}`;
        const response = await axios.get(apiUrl);
        const apiData = response.data;

        if (!apiData.status || !apiData.result) throw new Error("API failed to fetch track!");

        // Create fake contact for quoting
        const fakeContact = createFakeContact(message);

        // Send the audio directly with title as caption
        await sock.sendMessage(chatId, {
            audio: { url: apiData.result },
            mimetype: "audio/mpeg",
            fileName: `${video.title}.mp3`,
            caption: `🎶 *${apiData.title || video.title}*`
        }, { quoted: fakeContact });

    } catch (error) {
        console.error("Song command error:", error);
        return await sock.sendMessage(chatId, { 
            text: `🚫 Error: ${error.message}` 
        }, { quoted: message });
    }
}

module.exports = songCommand;