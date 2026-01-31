"use strict";

const express = require("express");
const router = express.Router();
const axios = require("axios");
const cheerio = require("cheerio");

// Helper para limpiar URLs y caracteres raros
function unescapeLoose(s) {
    if (!s) return "";
    return String(s)
        .replace(/\\u002F/g, "/")
        .replace(/\\"/g, '"')
        .replace(/&amp;/g, "&")
        .trim();
}

async function pindl(pinUrl) {
    try {
        const { data: html } = await axios.get(pinUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            },
            timeout: 15000
        });

        const $ = cheerio.load(html);
        const text = $.root().html() || "";

        // Extracción de MP4 y Thumbnail usando Regex sobre el HTML
        const mp4Url = text.match(/"v720P":\{"thumbnail":"[^"]+","url":"([^"]+)"/)?.[1] || 
                       text.match(/(https[^"]+_720w\.mp4)/)?.[1] ||
                       text.match(/"video_list":\{[^}]+"url":"([^"]+\.mp4[^"]*)"/)?.[1];

        const thumbnail = text.match(/"imageSpec_736x":\{"url":"([^"]+)"/)?.[1] || 
                          text.match(/og:image"[^>]+content="([^"]+)"/)?.[1];

        const title = text.match(/og:title"[^>]+content="([^"]+)"/)?.[1] || "Pinterest Video";

        if (!mp4Url) return null;

        return {
            title: unescapeLoose(title),
            video: unescapeLoose(mp4Url),
            thumbnail: unescapeLoose(thumbnail)
        };
    } catch (e) {
        return null;
    }
}

// Endpoint compatible con tu servidor
router.get("/", async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ status: false, message: "URL requerida" });

    const result = await pindl(url);
    if (!result) return res.status(404).json({ status: false, message: "No se encontró video" });

    res.json({
        creator: "Nexy",
        status: true,
        title: result.title,
        url: result.video
    });
});

module.exports = { router };
