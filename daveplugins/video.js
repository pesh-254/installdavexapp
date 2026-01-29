import axios from "axios";
import yts from "yt-search";
import fs from "fs";
import path from "path";

const emojis = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "emojis.json"), "utf8")
);

const BASE_URL = "https://noobs-api.top";
const sessions = new Map();

export default {
    name: "video",
    description: "Search YouTube and download video or document",
    category: "Youtube, Movies & Series Downloader",

    async execute(msg, { sock, args, settings }) {
        const from = msg.key.remoteJid;
        let input = args.join(" ").trim();
        
        const bodyText = msg.message?.conversation || 
                         msg.message?.extendedTextMessage?.text || "";
        
        let selection = "";
        if (input === "1" || input === "2") {
            selection = input;
        } else if (bodyText === "1" || bodyText === "2") {
            selection = bodyText;
        }

        if (selection && sessions.has(from)) {
            const video = sessions.get(from);
            sessions.delete(from);

            await sock.sendMessage(from, { react: { text: emojis.processing, key: msg.key } });

            try {
                const apiURL = `${BASE_URL}/dipto/ytDl3?link=${video.videoId}&format=mp4`;
                const res = await axios.get(apiURL, { timeout: 60000 });

                if (!res.data?.downloadLink) throw new Error("No download link");

                const caption = `🎬 *${video.title}*`;

                // Auto-fallback to document if file might be large or if document is selected
                if (selection === "1") {
                    try {
                        await sock.sendMessage(from, {
                            video: { url: res.data.downloadLink },
                            caption
                        }, { quoted: msg });
                    } catch (e) {
                        // Fallback to document if video send fails
                        await sock.sendMessage(from, {
                            document: { url: res.data.downloadLink },
                            mimetype: "video/mp4",
                            fileName: `${video.title.replace(/[\\/:*?"<>|]/g, "")}.mp4`,
                            caption: caption + "\n\n_Note: Sent as document due to size/compatibility_"
                        }, { quoted: msg });
                    }
                } else {
                    await sock.sendMessage(from, {
                        document: { url: res.data.downloadLink },
                        mimetype: "video/mp4",
                        fileName: `${video.title.replace(/[\\/:*?"<>|]/g, "")}.mp4`,
                        caption
                    }, { quoted: msg });
                }

                await sock.sendMessage(from, { react: { text: emojis.success, key: msg.key } });
            } catch (err) {
                console.error("Video download error:", err);
                await sock.sendMessage(from, { text: `❌ Download failed. The API might be down or the video is too large.` }, { quoted: msg });
                await sock.sendMessage(from, { react: { text: emojis.error, key: msg.key } });
            }
            return;
        }

        if (!input) {
            return sock.sendMessage(from, { text: `❌ *Provide search query*` }, { quoted: msg });
        }

        await sock.sendMessage(from, { react: { text: emojis.processing, key: msg.key } });

        try {
            const search = await yts(input);
            if (!search || !search.videos || search.videos.length === 0) {
                 return sock.sendMessage(from, { text: `❌ No results found for "${input}"` }, { quoted: msg });
            }
            const video = search.videos[0];
            
            sessions.set(from, video);

            const menuText = `🎬 *${video.title}*
⏱ *Duration:* ${video.timestamp}
👤 *Channel:* ${video.author.name}

*Reply with a number to download:*
1️⃣ *Video (MP4)*
2️⃣ *Document (File)*

_Note: Supports large files up to 2GB via document mode_`;

            await sock.sendMessage(from, { 
                image: { url: video.thumbnail },
                caption: menuText
            }, { quoted: msg });

        } catch (err) {
            console.error("Video search error:", err);
            await sock.sendMessage(from, { text: `❌ Search failed. Try a different query.` }, { quoted: msg });
        }
    }
};
