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
        // Send reaction
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

        let videoUrl;
        let videoTitle;
        let videoThumbnail;
        let videoId;

        // Check if input is a YouTube URL
        if (query.match(/(youtube\.com|youtu\.be)/i)) {
            videoUrl = query;
            const match = query.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
            videoId = match ? match[1] : null;
            videoTitle = "YouTube Audio";
            videoThumbnail = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null;
        } else {
            // Search video using Keith API
            let videos = await apis.keith.search(query);
            
            // Fallback to yts if Keith API fails
            if (!videos || videos.length === 0) {
                const ytSearch = await yts(query);
                videos = ytSearch.videos || [];
            }

            if (!videos || videos.length === 0) {
                return await sock.sendMessage(chatId, { 
                    text: "❌ Couldn't find that song. Try another one!"
                }, { quoted: fakeContact });
            }

            const video = videos[0];
            videoUrl = video.url || `https://youtube.com/watch?v=${video.videoId || video.id}`;
            videoTitle = video.title;
            videoThumbnail = video.thumbnail || video.image;
            videoId = video.videoId || video.id;
        }

        // Send searching message
        const processingMsg = await sock.sendMessage(chatId, {
            text: `🎵 *Searching:* ${videoTitle}\n⬇️ *Downloading audio...*`
        }, { quoted: fakeContact });

        // Get audio URL from Keith API
        const audioData = await apis.keith.downloadAudio(videoUrl);
        let audioUrl = audioData?.downloadUrl;

        // Fallback to y2mate if Keith API fails
        if (!audioUrl) {
            audioUrl = await apis.y2mate.downloadAudio(videoUrl);
        }

        if (!audioUrl) {
            // Delete processing message
            if (processingMsg) {
                await sock.sendMessage(chatId, {
                    delete: processingMsg.key
                });
            }
            return await sock.sendMessage(chatId, { 
                text: "❌ Audio service unavailable. Try again later."
            }, { quoted: fakeContact });
        }

        // Delete processing message
        if (processingMsg) {
            await sock.sendMessage(chatId, {
                delete: processingMsg.key
            });
        }

        // Create context info for better message appearance
        const contextInfo = {
            externalAdReply: {
                title: videoTitle.substring(0, 60),
                body: '📁 Document Version',
                mediaType: 1,
                thumbnailUrl: videoThumbnail,
                renderLargerThumbnail: false,
                sourceUrl: videoUrl
            }
        };

        const fileName = `${videoTitle.replace(/[^\w\s.-]/gi, '')}.mp3`;

        // Send document only
        await sock.sendMessage(chatId, {
            document: { url: audioUrl },
            mimetype: "audio/mpeg",
            fileName: fileName.substring(0, 100),
            contextInfo
        }, { quoted: fakeContact });

        // Optional: Send success message
        await sock.sendMessage(chatId, {
            text: `✅ *Download Complete!*\n📁 *File:* ${videoTitle.substring(0, 50)}...\n🎵 *Format:* MP3 Audio`
        }, { quoted: fakeContact });

    } catch (error) {
        console.error("Play command error:", error);
        await sock.sendMessage(chatId, {
            text: "❌ Download failed. Error: " + error.message
        }, { quoted: fakeContact });
    }
}

module.exports = playCommand;