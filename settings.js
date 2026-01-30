// settings.js - SAFE VERSION
export default {
  // OpenAI API configuration
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  
  // Giphy API configuration
  giphyApiKey: process.env.GIPHY_API_KEY || '',
  
  // Gemini API configuration
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  
  // Imgur API configuration
  imgurClientId: process.env.IMGUR_CLIENT_ID || '',
  
  // Copilot API configuration
  copilotApiKey: process.env.COPILOT_API_KEY || '',
  
  // Football API configuration
  FOOTBALL_API_KEY: process.env.FOOTBALL_API_KEY || '',
  
  // Mega.nz credentials for auth storage
  megaEmail: process.env.MEGA_EMAIL || '',
  megaPassword: process.env.MEGA_PASSWORD || '',
};