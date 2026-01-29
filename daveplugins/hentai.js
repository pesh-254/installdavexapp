import axios from 'axios';

async function hentaiScraper() {
  try {
    // Try multiple APIs for better reliability
    const apis = [
      'https://api.waifu.pics/nsfw/waifu',
      'https://nekos.best/api/v2/neko',
      'https://api.waifu.im/search/?included_tags=hentai',
      'https://purrbot.site/api/img/nsfw/hentai/gif'
    ];
    
    for (const api of apis) {
      try {
        const response = await axios.get(api, { timeout: 10000 });
        if (response.data) {
          if (response.data.url) return { url: response.data.url };
          if (response.data.results && response.data.results[0]) return { url: response.data.results[0].url };
          if (response.data.images && response.data.images[0]) return { url: response.data.images[0].url };
          if (response.data.link) return { url: response.data.link };
        }
      } catch (apiError) {
        console.log(`API ${api} failed, trying next...`);
        continue;
      }
    }
    throw new Error('All APIs failed');
  } catch (error) {
    throw error;
  }
}

export default {
  name: 'hentai',
  description: '🔞 Get random hentai posts',
  async execute(msg, { sock }) {
    try {
      const result = await hentaiScraper();
      if (!result.url) {
        return await sock.sendMessage(msg.key.remoteJid, { 
          text: '😔 No media found.' 
        }, { quoted: msg });
      }
      
      await sock.sendMessage(msg.key.remoteJid, {
        image: { url: result.url },
        caption: `🔞 Random Hentai Image\n\n💡 *Tip:* Content is randomly sourced from anime APIs`
      }, { quoted: msg });
    } catch (error) {
      console.error('Hentai command error:', error);
      await sock.sendMessage(msg.key.remoteJid, { 
        text: '⚠️ Error fetching hentai content. Please try again later.' 
      }, { quoted: msg });
    }
  }
};
