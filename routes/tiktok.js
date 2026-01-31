"use strict";

const express = require("express");
const router = express.Router();
const axios = require("axios");

/**
 * Limpia y formatea las URLs de TikWM
 */
function formatUrl(url) {
    if (!url) return null;
    if (url.startsWith('http')) return url; // Si ya es completa, dejarla así
    return `https://www.tikwm.com${url}`;   // Si es relativa, añadir dominio
}

async function tiktokScraper(tiktokUrl) {
    const endpoint = `https://www.tikwm.com/api/?url=${encodeURIComponent(tiktokUrl)}&hd=1`;
    
    try {
        const { data } = await axios.get(endpoint, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            },
            timeout: 10000
        });

        const d = data?.data;
        if (!d) return null;

        // Limpieza de URLs para evitar el bug de "https://www.tikwm.comhttps://..."
        return {
            title: d.title || "TikTok Video",
            author: {
                nickname: d.author?.nickname || "N/A",
                username: d.author?.unique_id || "N/A",
                avatar: formatUrl(d.author?.avatar)
            },
            stats: {
                views: d.play_count || 0,
                likes: d.digg_count || 0,
                comments: d.comment_count || 0,
                shares: d.share_count || 0
            },
            media: {
                video_hd: formatUrl(d.hdplay || d.play),
                video_wm: formatUrl(d.wmplay),
                audio: formatUrl(d.music),
                cover: formatUrl(d.cover)
            }
        };
    } catch (error) {
        throw new Error("TikTok API Error: " + error.message);
    }
}

router.get("/", async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ status: false, creator: "Nexy", message: "Falta URL" });

    try {
        const result = await tiktokScraper(url);
        if (!result) return res.status(404).json({ status: false, creator: "Nexy", message: "No se encontró el video" });

        res.json({
            status: true,
            creator: "Nexy",
            result: result
        });
    } catch (error) {
        res.status(500).json({ status: false, creator: "Nexy", message: error.message });
    }
});

module.exports = { router };
