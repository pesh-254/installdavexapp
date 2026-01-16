const fs = require("fs");
const axios = require('axios');
const yts = require('yt-search');
const path = require('path');

// Working APIs based on your Keith pattern
const apis = {
  keith: {
    search: async (query) => {
      try {
        const response = await axios.get(
          `https://apiskeith.vercel.app/search/yts?query=${encodeURIComponent(query)}`,
          { timeout: 10000 }
        );
        return response.data?.result || [];
      } catch (error) {
        console.error("Keith search error:", error.message);
        return [];
      }
    },
    downloadAudio: async (url) => {
      try {
        const response = await axios.get(
          `https://apiskeith.vercel.app/download/audio?url=${encodeURIComponent(url)}`,
          { timeout: 15000 }
        );
        return response.data?.result;
      } catch (error) {
        console.error("Keith download error:", error.message);
        return null;
      }
    }
  }
};

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
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Music;;;\nFN:Davex Audio Download\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Music Bot\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function songCommand(sock, chatId, message) {
    const fakeContact = createFakeContact(message);

    try {
        await sock.sendMessage(chatId, {
            react: { text: "🎵", key: message.key }
        });

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.split(' ').slice(1).join(' ').trim();

        if (!searchQuery) {
            return await sock.sendMessage(chatId, { 
                text: "Specify track to download" 
            }, { quoted: fakeContact });
        }

        // Search video
        let videos = await apis.keith.search(searchQuery);
        if (!videos || videos.length === 0) {
            const ytSearch = await yts(searchQuery);
            videos = ytSearch.videos || [];
        }

        if (!videos || videos.length === 0) {
            return await sock.sendMessage(chatId, { 
                text: "Track search returned zero results" 
            }, { quoted: fakeContact });
        }

        const video = videos[0];
        const urlYt = video.url || `https://youtube.com/watch?v=${video.videoId || video.id}`;

        // Get audio URL from Keith API
        const audioData = await apis.keith.downloadAudio(urlYt);
        if (!audioData?.downloadUrl) {
            return await sock.sendMessage(chatId, { 
                text: "Audio retrieval unsuccessful" 
            }, { quoted: fakeContact });
        }

        const audioUrl = audioData.downloadUrl;
        const title = video.title;

        // Send audio directly as document
        await sock.sendMessage(chatId, {
            document: { url: audioUrl },
            mimetype: "audio/mpeg",
            fileName: `${title.replace(/[^\w\s-]/g, '').substring(0, 50)}.mp3`
        }, { quoted: fakeContact });

    } catch (error) {
        console.error('Error in songCommand:', error);
        await sock.sendMessage(chatId, { 
            text: "Audio download failed" 
        }, { quoted: fakeContact });
    }
}

module.exports = songCommand;