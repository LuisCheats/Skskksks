import axios from "axios"
import { createApiKeyMiddleware } from "../../middleware/apikey.js"

export default (app) => {
  async function getWaifuNSFW() {
    try {
      const { data } = await axios.get("https://api.waifu.pics/nsfw/waifu")

      const response = await axios.get(data.url, {
        responseType: "arraybuffer",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Bot/1.0)"
        }
      })

      return {
        buffer: Buffer.from(response.data),
        contentType: response.headers["content-type"] || "image/png"
      }

    } catch (error) {
      throw new Error("No se pudo descargar la imagen: " + error.message)
    }
  }

  app.get("/nsfw/nsfw1", createApiKeyMiddleware(), async (req, res) => {
    try {
      const { buffer, contentType } = await getWaifuNSFW()

      res.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": buffer.length
      })
      res.end(buffer)

      console.log("NSFW waifu enviada con éxito")

    } catch (error) {
      res.status(500).json({
        status: false,
        message: "No se pudo obtener la imagen NSFW",
        error: error.message
      })
    }
  })
}