import axios from 'axios';
import fs from 'fs';
import path from 'path';

const emojisPath = path.join(process.cwd(), 'data', 'emojis.json');
const emojis = JSON.parse(fs.readFileSync(emojisPath, 'utf8'));

const PREXZY_API = 'https://apis.prexzyvilla.site/anime';

async function fetchMangaHome(page = 1) {
    const { data } = await axios.get(`${PREXZY_API}/manga-home`, {
        params: { page },
        timeout: 30000
    });
    return data;
}

async function searchManga(query) {
    const { data } = await axios.get(`${PREXZY_API}/manga-search`, {
        params: { query },
        timeout: 30000
    });
    return data;
}

async function getMangaDetails(mangaId) {
    const { data } = await axios.get(`${PREXZY_API}/manga-info`, {
        params: { id: mangaId },
        timeout: 30000
    });
    return data;
}

async function getMangaChapter(chapterId) {
    const { data } = await axios.get(`${PREXZY_API}/manga-chapter`, {
        params: { chapterId },
        timeout: 30000
    });
    return data;
}

const mangaHomeCommand = {
    name: 'mangahome',
    description: 'Get latest manga updates from home page',
    async execute(msg, { sock, args, settings }) {
        const from = msg.key.remoteJid;
        const page = parseInt(args[0]) || 1;
        
        try {
            await sock.sendMessage(from, {
                react: { text: emojis.processing, key: msg.key }
            });
            
            const result = await fetchMangaHome(page);
            
            if (!result.status || !result.data?.length) {
                return await sock.sendMessage(from, {
                    text: `${emojis.error} No manga found!`
                }, { quoted: msg });
            }
            
            let text = `📚 *LATEST MANGA UPDATES* (Page ${page})\n\n`;
            
            for (let i = 0; i < Math.min(result.data.length, 10); i++) {
                const manga = result.data[i];
                text += `*${i + 1}. ${manga.title}*\n`;
                text += `├ 📖 Latest: Chapter ${manga.latestChapterNumber || 'N/A'}\n`;
                text += `├ 🏷️ Genre: ${manga.genres?.join(', ') || 'N/A'}\n`;
                text += `├ 📰 ID: \`${manga.id}\`\n`;
                text += `└ ${manga.readerInfo || ''}\n\n`;
            }
            
            text += `\n💡 *Usage:*\n`;
            text += `• ${settings.prefix}mangainfo <manga-id> - Get manga details\n`;
            text += `• ${settings.prefix}mangasearch <query> - Search manga\n`;
            text += `• ${settings.prefix}mangahome ${page + 1} - Next page`;
            
            const coverUrl = result.data[0]?.coverImages?.[0]?.imageUrls?.[0];
            
            if (coverUrl) {
                await sock.sendMessage(from, {
                    image: { url: coverUrl },
                    caption: text
                }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text }, { quoted: msg });
            }
            
            await sock.sendMessage(from, {
                react: { text: emojis.success, key: msg.key }
            });
            
        } catch (error) {
            console.error('[MANGA HOME] Error:', error.message);
            await sock.sendMessage(from, {
                text: `${emojis.error} Failed to fetch manga: ${error.message}`
            }, { quoted: msg });
        }
    }
};

const mangaSearchCommand = {
    name: 'mangasearch',
    description: 'Search for manga by title',
    async execute(msg, { sock, args, settings }) {
        const from = msg.key.remoteJid;
        const query = args.join(' ').trim();
        
        if (!query) {
            return await sock.sendMessage(from, {
                text: `${emojis.error} Please provide a search query!\n\nExample: ${settings.prefix}mangasearch One Piece`
            }, { quoted: msg });
        }
        
        try {
            await sock.sendMessage(from, {
                react: { text: emojis.processing, key: msg.key }
            });
            
            const result = await searchManga(query);
            
            if (!result.status || !result.data?.length) {
                return await sock.sendMessage(from, {
                    text: `${emojis.error} No manga found for "${query}"!`
                }, { quoted: msg });
            }
            
            let text = `🔍 *MANGA SEARCH RESULTS*\nQuery: "${query}"\n\n`;
            
            for (let i = 0; i < Math.min(result.data.length, 10); i++) {
                const manga = result.data[i];
                text += `*${i + 1}. ${manga.title}*\n`;
                text += `├ 📖 Latest: Chapter ${manga.latestChapterNumber || 'N/A'}\n`;
                text += `├ 🏷️ Genre: ${manga.genres?.join(', ') || 'N/A'}\n`;
                text += `└ 📰 ID: \`${manga.id}\`\n\n`;
            }
            
            text += `\n💡 Use: ${settings.prefix}mangainfo <manga-id>`;
            
            const coverUrl = result.data[0]?.coverImages?.[0]?.imageUrls?.[0];
            
            if (coverUrl) {
                await sock.sendMessage(from, {
                    image: { url: coverUrl },
                    caption: text
                }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text }, { quoted: msg });
            }
            
            await sock.sendMessage(from, {
                react: { text: emojis.success, key: msg.key }
            });
            
        } catch (error) {
            console.error('[MANGA SEARCH] Error:', error.message);
            await sock.sendMessage(from, {
                text: `${emojis.error} Search failed: ${error.message}`
            }, { quoted: msg });
        }
    }
};

const mangaInfoCommand = {
    name: 'mangainfo',
    description: 'Get detailed manga information',
    async execute(msg, { sock, args, settings }) {
        const from = msg.key.remoteJid;
        const mangaId = args.join('-').trim() || args[0];
        
        if (!mangaId) {
            return await sock.sendMessage(from, {
                text: `${emojis.error} Please provide a manga ID!\n\nExample: ${settings.prefix}mangainfo naruto`
            }, { quoted: msg });
        }
        
        try {
            await sock.sendMessage(from, {
                react: { text: emojis.processing, key: msg.key }
            });
            
            const result = await getMangaDetails(mangaId);
            
            if (!result.status || !result.data) {
                return await sock.sendMessage(from, {
                    text: `${emojis.error} Manga not found!`
                }, { quoted: msg });
            }
            
            const manga = result.data;
            
            let text = `📚 *${manga.title}*\n\n`;
            text += `📝 *Description:*\n${manga.description || 'No description'}\n\n`;
            text += `🏷️ *Genres:* ${manga.genres?.join(', ') || 'N/A'}\n`;
            text += `📖 *Chapters:* ${manga.totalChapters || manga.chapters?.length || 'N/A'}\n`;
            text += `✍️ *Author:* ${manga.author || 'Unknown'}\n`;
            text += `📊 *Status:* ${manga.status || 'Unknown'}\n\n`;
            
            if (manga.chapters?.length) {
                text += `📑 *Recent Chapters:*\n`;
                const recentChapters = manga.chapters.slice(0, 5);
                for (const ch of recentChapters) {
                    text += `• Chapter ${ch.number || ch.chapterNumber}: ${ch.title || ''}\n`;
                }
            }
            
            text += `\n💡 Use: ${settings.prefix}mangaread <chapter-id>`;
            
            const coverUrl = manga.coverImages?.[0]?.imageUrls?.[0] || manga.cover;
            
            if (coverUrl) {
                await sock.sendMessage(from, {
                    image: { url: coverUrl },
                    caption: text
                }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text }, { quoted: msg });
            }
            
            await sock.sendMessage(from, {
                react: { text: emojis.success, key: msg.key }
            });
            
        } catch (error) {
            console.error('[MANGA INFO] Error:', error.message);
            await sock.sendMessage(from, {
                text: `${emojis.error} Failed to get manga info: ${error.message}`
            }, { quoted: msg });
        }
    }
};

const mangaReadCommand = {
    name: 'mangaread',
    description: 'Read a manga chapter',
    async execute(msg, { sock, args, settings }) {
        const from = msg.key.remoteJid;
        const chapterId = args.join('-').trim() || args[0];
        
        if (!chapterId) {
            return await sock.sendMessage(from, {
                text: `${emojis.error} Please provide a chapter ID!\n\nExample: ${settings.prefix}mangaread naruto-chapter-1`
            }, { quoted: msg });
        }
        
        try {
            await sock.sendMessage(from, {
                react: { text: emojis.processing, key: msg.key }
            });
            
            await sock.sendMessage(from, {
                text: `📖 Fetching chapter images... This may take a moment.`
            }, { quoted: msg });
            
            const result = await getMangaChapter(chapterId);
            
            if (!result.status || !result.data) {
                return await sock.sendMessage(from, {
                    text: `${emojis.error} Chapter not found!`
                }, { quoted: msg });
            }
            
            const chapter = result.data;
            const images = chapter.images || chapter.pages || [];
            
            if (!images.length) {
                return await sock.sendMessage(from, {
                    text: `${emojis.error} No images found for this chapter!`
                }, { quoted: msg });
            }
            
            await sock.sendMessage(from, {
                text: `📖 *${chapter.title || chapterId}*\n\n📄 Total Pages: ${images.length}\n\n⏳ Sending pages...`
            }, { quoted: msg });
            
            const maxPages = Math.min(images.length, 10);
            for (let i = 0; i < maxPages; i++) {
                try {
                    const imageUrl = typeof images[i] === 'string' ? images[i] : images[i].url;
                    await sock.sendMessage(from, {
                        image: { url: imageUrl },
                        caption: `📄 Page ${i + 1}/${images.length}`
                    });
                } catch (e) {
                    console.error(`[MANGA READ] Failed to send page ${i + 1}:`, e.message);
                }
            }
            
            if (images.length > 10) {
                await sock.sendMessage(from, {
                    text: `📄 Showing first 10 pages of ${images.length}.\n\nVisit the source for full chapter.`
                }, { quoted: msg });
            }
            
            await sock.sendMessage(from, {
                react: { text: emojis.success, key: msg.key }
            });
            
        } catch (error) {
            console.error('[MANGA READ] Error:', error.message);
            await sock.sendMessage(from, {
                text: `${emojis.error} Failed to fetch chapter: ${error.message}`
            }, { quoted: msg });
        }
    }
};

export default [mangaHomeCommand, mangaSearchCommand, mangaInfoCommand, mangaReadCommand];
