const axios = require('axios');

const GPT_API = {
    baseURL: "https://iamtkm.vercel.app",
    endpoint: "/ai/gpt5",
    apiKey: "tkm"
};

async function aiCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || 
                    message.message?.extendedTextMessage?.text;

        if (!text) {
            return await sock.sendMessage(chatId, { 
                text: "GPT-5 Assistant\n\nUse: !ai [your question]\nExample: !ai explain machine learning" 
            });
        }

        const parts = text.split(' ');
        const query = parts.slice(1).join(' ').trim();

        if (!query) {
            return await sock.sendMessage(chatId, { 
                text: "Need a question after !ai\nExample: !ai what is quantum physics" 
            });
        }

        await sock.sendMessage(chatId, {
            react: { text: '⚡', key: message.key }
        });

        await processAIRequest(sock, chatId, message, query);

    } catch (error) {
        console.error('AI Command Error:', error);
        await sock.sendMessage(chatId, {
            text: "AI service down. Try again later."
        });
    }
}

async function processAIRequest(sock, chatId, message, query) {
    try {
        const apiUrl = `${GPT_API.baseURL}${GPT_API.endpoint}?apikey=${GPT_API.apiKey}&text=${encodeURIComponent(query)}`;
        
        const response = await axios.get(apiUrl, { 
            timeout: 30000,
            headers: {
                'User-Agent': 'WhatsApp-Bot/1.0',
                'Accept': 'application/json'
            }
        });
        
        const data = response.data;
        
        if (data.status && data.statusCode === 200 && data.result) {
            await sock.sendMessage(chatId, {
                text: data.result
            });
            
            await sock.sendMessage(chatId, {
                react: { text: '✅', key: message.key }
            });
        } else {
            await sock.sendMessage(chatId, {
                text: "AI couldn't generate a response. Try a different question."
            });
        }

    } catch (error) {
        console.error('AI API Error:', error.message);
        
        if (error.response?.status === 429) {
            await sock.sendMessage(chatId, {
                text: "Rate limit. Wait 5 minutes."
            });
        } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
            await sock.sendMessage(chatId, {
                text: "Request timeout. Try shorter question."
            });
        } else {
            await sock.sendMessage(chatId, {
                text: "AI service error. Try later."
            });
        }

        await sock.sendMessage(chatId, {
            react: { text: '❌', key: message.key }
        });
    }
}

module.exports = aiCommand;