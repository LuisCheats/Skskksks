"use strict";

const express = require("express");
const router = express.Router();
const axios = require("axios");
const { Readable } = require("stream");

// --- CONFIGURACIÓN ---
const config = {
  route: "/api/dl/twitter"
};

/**
 * Limpia y normaliza la URL de X/Twitter
 */
function makeurl(url) {
  let u = String(url || "").trim();
  u = u.replace(/twitter\.com/i, "x.com");
  const match = u.match(/(https:\/\/x\.com\/[^\/]+\/status\/\d+)/i);
  return match ? match[1] : u;
}

/**
 * Lógica del Scraper usando vxtwitter
 */
async function xdown(url) {
  const cleanedURL = makeurl(url);
  const apiURL = cleanedURL.replace("x.com", "api.vxtwitter.com");

  try {
    const r = await axios.get(apiURL, { timeout: 15000 });
    const result = r.data;

    if (!result || !result.media_extended) return { found: false };

    return {
      found: true,
      text: result.text,
      author: result.user_name,
      username: result.user_screen_name,
      date: result.date,
      media: result.media_extended.map(m => ({
        url: m.url,
        type: m.type,
        thumbnail: m.thumbnail_url
      })),
      stats: {
        likes: result.likes,
        retweets: result.retweets,
        replies: result.replies
      }
    };
  } catch (e) {
    return { found: false, error: e.message };
  }
}

// Endpoint Principal: GET /api/downloader/twitter?url=...
router.get("/", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ status: false, message: "URL de X requerida" });

  const data = await xdown(url);
  if (!data.found) return res.status(404).json({ status: false, message: "No se encontró contenido multimedia" });

  res.json({
    status: true,
    creator: "NEXY",
    result: {
      author: data.author,
      username: data.username,
      description: data.text,
      date: data.date,
      stats: data.stats,
      media: data.media.map((m, i) => ({
        type: m.type,
        url: m.url
      }))
    }
  });
});

// Proxy de descarga para evitar bloqueos de X
router.get("/dl", async (req, res) => {
  const { src, type } = req.query;
  if (!src) return res.status(400).send("Falta src");

  try {
    const response = await axios({
      method: 'get',
      url: src,
      responseType: 'stream',
      headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://x.com/" }
    });

    const ext = type === 'video' ? 'mp4' : 'jpg';
    res.setHeader("Content-Disposition", `attachment; filename="x_download.${ext}"`);
    response.data.pipe(res);
  } catch (e) {
    res.status(500).send("Error en la descarga");
  }
});

module.exports = { router };
