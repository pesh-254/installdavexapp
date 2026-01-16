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
  },

  y2mate: {
    downloadAudio: async (url) => {
      try {
        const response = await axios.get(
          `https://api.beautyofweb.com/y2mate?url=${encodeURIComponent(url)}&type=mp3`,
          { timeout: 15000 }
        );
        return response.data?.result?.audio?.url;
      } catch (error) {
        console.error("Y2Mate error:", error.message);
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
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Music;;;\nFN:Davex Music Player\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Music Bot\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function playCommand(sock, chatId, message) {
    const fakeContact = createFakeContact(message);

    try { 
        await sock.sendMessage(chatId, {
            react: { text: '🎼', key: message.key }
        });

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const parts = text.split(' ');
        const query = parts.slice(1).join(' ').trim();

        if (!query) {
            return await sock.sendMessage(chatId, { 
                text: 'Provide a song name.\nExample: .play Not Like Us'
            }, { quoted: fakeContact });
        }

        // Search video
        let videos = await apis.keith.search(query);
        if (!videos || videos.length === 0) {
            const ytSearch = await yts(query);
            videos = ytSearch.videos || [];
        }

        if (!videos || videos.length === 0) {
            return await sock.sendMessage(chatId, { 
                text: "Couldn't find that song. Try another one!"
            }, { quoted: fakeContact });
        }

        const video = videos[0];
        const urlYt = video.url || `https://youtube.com/watch?v=${video.videoId || video.id}`;

        // Get audio URL
        const audioData = await apis.keith.downloadAudio(urlYt);
        let audioUrl = audioData?.downloadUrl;
        
        if (!audioUrl) {
            audioUrl = await apis.y2mate.downloadAudio(urlYt);
        }

        if (!audioUrl) {
            return await sock.sendMessage(chatId, { 
                text: "Audio service unavailable. Try again later."
            }, { quoted: fakeContact });
        }

        // Send audio directly
        await sock.sendMessage(chatId, {
            audio: { url: audioUrl },
            mimetype: "audio/mpeg",
            fileName: `${video.title.replace(/[^\w\s-]/g, '').substring(0, 50)}.mp3`
        }, { quoted: fakeContact });

    } catch (error) {
        console.error("Play command error:", error);
        await sock.sendMessage(chatId, {
            text: "Audio download failed"
        }, { quoted: fakeContact });
    }
}

module.exports = playCommand;