import axios from "axios"
import { createApiKeyMiddleware } from "../../middleware/apikey.js"

export default (app) => {
  
  async function fetchContent(content) {
    try {
      // 🔥 Panggil API Anabot DeepSeek
      const response = await axios.get(
        "https://anabot.my.id/api/ai/deepseek",
        {
          params: {
            prompt: content,
            search_enabled: false,
            thinking_enabled: false,
            apikey: "free"
          }
        }
      )
      
      return {
        result: response.data?.result || response.data || "Tidak ada output."
      }
      
    } catch (error) {
      console.error("Error fetching content from DeepSeek Anabot:", error)
      throw error
    }
  }
  
  app.get("/ai/luminai", createApiKeyMiddleware(), async (req, res) => {
    try {
      const { text } = req.query
      
      if (!text) {
        return res.status(400).json({ status: false, error: "Text is required" })
      }
      
      const { result } = await fetchContent(text)
      
      return res.status(200).json({
        status: true,
        result
      })
      
    } catch (error) {
      res.status(500).json({
        status: false,
        error: error.message
      })
    }
  })
}