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

  // Alternative APIs as fallback
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
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Music;;;\nFN:Davex Audio Player\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Music Bot\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function songCommand(sock, chatId, message) {
    const fakeContact = createFakeContact(message);

    try {
        // Send reaction
        await sock.sendMessage(chatId, {
            react: { text: "🎵", key: message.key }
        });

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.split(' ').slice(1).join(' ').trim();

        if (!searchQuery) {
            return await sock.sendMessage(chatId, { 
                text: "🎵 *Song Downloader*\n\nSpecify a song to download.\n\nExample: .song Not Like Us" 
            }, { quoted: fakeContact });
        }

        // Send searching message
        const processingMsg = await sock.sendMessage(chatId, {
            text: `🔍 *Searching:* "${searchQuery}"...`
        }, { quoted: fakeContact });

        // Search video
        let videos = await apis.keith.search(searchQuery);
        if (!videos || videos.length === 0) {
            const ytSearch = await yts(searchQuery);
            videos = ytSearch.videos || [];
        }

        if (!videos || videos.length === 0) {
            if (processingMsg) {
                await sock.sendMessage(chatId, { delete: processingMsg.key });
            }
            return await sock.sendMessage(chatId, { 
                text: "❌ No results found for that song.\n\nTry a different search term." 
            }, { quoted: fakeContact });
        }

        const video = videos[0];
        const urlYt = video.url || `https://youtube.com/watch?v=${video.videoId || video.id}`;
        const title = video.title;
        const thumbnail = video.thumbnail || video.image;
        const videoId = video.videoId || video.id;

        // Update processing message
        if (processingMsg) {
            await sock.sendMessage(chatId, {
                edit: processingMsg.key,
                text: `🔍 *Searching:* "${searchQuery}"...\n✅ *Found:* ${title}\n⬇️ *Downloading audio...*`
            });
        }

        // Get audio URL from Keith API
        const audioData = await apis.keith.downloadAudio(urlYt);
        let audioUrl = audioData?.downloadUrl;

        // Fallback to y2mate if Keith API fails
        if (!audioUrl) {
            audioUrl = await apis.y2mate.downloadAudio(urlYt);
        }

        if (!audioUrl) {
            if (processingMsg) {
                await sock.sendMessage(chatId, { delete: processingMsg.key });
            }
            return await sock.sendMessage(chatId, { 
                text: "❌ Audio download service is currently unavailable.\n\nPlease try again later." 
            }, { quoted: fakeContact });
        }

        // Delete processing message
        if (processingMsg) {
            await sock.sendMessage(chatId, { delete: processingMsg.key });
        }

        // Create context info for rich preview
        const contextInfo = {
            externalAdReply: {
                title: title.substring(0, 60),
                body: '🎵 Davex Music Player',
                mediaType: 1,
                thumbnailUrl: thumbnail,
                renderLargerThumbnail: false,
                sourceUrl: urlYt
            }
        };

        const fileName = `${title.replace(/[^\w\s.-]/gi, '')}.mp3`.substring(0, 100);

        // Send as AUDIO (playable in WhatsApp)
        await sock.sendMessage(chatId, {
            audio: { url: audioUrl },
            mimetype: "audio/mpeg",
            fileName: fileName,
            ptt: false, // Set to false for music (not voice note)
            contextInfo
        }, { quoted: fakeContact });

        // Optional: Send success message
        await sock.sendMessage(chatId, {
            text: `✅ *Download Successful!*\n\n🎵 *Title:* ${title}\n📊 *Quality:* MP3 Audio\n🔊 *Playable in WhatsApp*`
        }, { quoted: fakeContact });

    } catch (error) {
        console.error('Error in songCommand:', error);
        
        // Try to send error message
        try {
            await sock.sendMessage(chatId, { 
                text: `❌ Download failed.\n\nError: ${error.message || "Unknown error"}\n\nPlease try again with a different song.` 
            }, { quoted: fakeContact });
        } catch (e) {
            console.error("Failed to send error message:", e);
        }
    }
}

module.exports = songCommand;