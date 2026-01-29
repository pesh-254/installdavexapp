
import axios from 'axios';

async function fetchBlowjob() {
  const apis = [
    { url: 'https://api.waifu.pics/nsfw/blowjob', format: 'url' },
    { url: 'https://purrbot.site/api/img/nsfw/blowjob/gif', format: 'link' }
  ];

  for (const api of apis) {
    try {
      const response = await axios.get(api.url, { timeout: 10000 });
      if (response.data) {
        if (api.format === 'url' && response.data.url) return response.data.url;
        if (api.format === 'link' && response.data.link) return response.data.link;
      }
    } catch (error) {
      console.log(`[NSFW blowjob] API ${api.url} failed, trying next...`);
      continue;
    }
  }
  throw new Error('All APIs failed');
}

export default {
  name: 'blowjob',
  description: '🔞 Get random blowjob content',
  category: 'NSFW',
  async execute(msg, { sock }) {
    const dest = msg.key.remoteJid;
    try {
      await sock.sendMessage(dest, {
        react: { text: '⏳', key: msg.key }
      });

      const url = await fetchBlowjob();
      
      await sock.sendMessage(dest, {
        image: { url },
        caption: '🔞 *Random Blowjob Content*\n\n⚠️ NSFW Content'
      }, { quoted: msg });

      await sock.sendMessage(dest, {
        react: { text: '✅', key: msg.key }
      });
    } catch (error) {
      console.error('[NSFW blowjob] Error:', error.message);
      await sock.sendMessage(dest, {
        text: '❌ Failed to fetch blowjob content. Try again later.'
      }, { quoted: msg });
    }
  }
};
