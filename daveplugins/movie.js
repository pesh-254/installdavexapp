import axios from "axios";
import fs from "fs";
import path from "path";

const emojis = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "emojis.json"), "utf8")
);

const sessions = new Map();

export default {
    name: "movie",
    description: "Search and download movies/series",
    category: "Youtube, Movies & Series Downloader",
    aliases: ["series", "film"],

    async execute(msg, { sock, args }) {
        const from = msg.key.remoteJid;
        let input = args.join(" ").trim();
        const bodyText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";

        if (sessions.has(from) && !isNaN(bodyText)) {
            const session = sessions.get(from);
            const index = parseInt(bodyText) - 1;
            const episode = session.episodes[index];
            
            if (!episode) return sock.sendMessage(from, { text: "❌ Invalid episode number." });
            
            sessions.delete(from);
            await sock.sendMessage(from, { react: { text: emojis.processing, key: msg.key } });
            
            try {
                const videoUrl = "https://example.com/movie.mp4"; // Placeholder for real API link
                
                // Try sending as video first
                try {
                    await sock.sendMessage(from, {
                        video: { url: videoUrl },
                        caption: `🎬 *${episode.title}*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝔼𝕔𝕝𝕚𝕡𝕤𝕖 𝕄𝔻`
                    }, { quoted: msg });
                } catch (e) {
                    // Fallback to document if too large or fails
                    await sock.sendMessage(from, {
                        document: { url: videoUrl },
                        mimetype: "video/mp4",
                        fileName: `${episode.title}.mp4`,
                        caption: `🎬 *${episode.title}*\n\n_Note: Sent as document due to size/compatibility_`
                    }, { quoted: msg });
                }
                
                await sock.sendMessage(from, { react: { text: emojis.success, key: msg.key } });
            } catch (err) {
                await sock.sendMessage(from, { text: "❌ Download failed." });
            }
            return;
        }

        if (!input) {
            return sock.sendMessage(from, { text: "❌ *Provide movie/series name to search.*" });
        }

        await sock.sendMessage(from, { react: { text: emojis.processing, key: msg.key } });

        try {
            // Simulated search result with all episodes
            const movieData = {
                title: input,
                thumbnail: "https://files.catbox.moe/vsxdpj.jpg",
                episodes: [
                    { title: `${input} - Episode 1` },
                    { title: `${input} - Episode 2` },
                    { title: `${input} - Episode 3` },
                    { title: `${input} - Episode 4` },
                    { title: `${input} - Episode 5` }
                ]
            };

            sessions.set(from, { episodes: movieData.episodes });

            let listText = `🎬 *${movieData.title}*\n\n`;
            movieData.episodes.forEach((epi, i) => {
                listText += `${i + 1}️⃣ ${epi.title}\n`;
            });
            listText += `\n*Reply with the episode number to download.*`;

            await sock.sendMessage(from, { 
                image: { url: movieData.thumbnail },
                caption: listText 
            }, { quoted: msg });

        } catch (err) {
            await sock.sendMessage(from, { text: "❌ Movie search failed." });
        }
    }
};
