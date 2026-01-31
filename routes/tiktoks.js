"use strict";

const express = require("express");
const router = express.Router();
const fetch = (...args) => import("node-fetch").then(m => m.default(...args));

/**
 * Función para limpiar y corregir URLs duplicadas de TikWM
 */
function fixUrl(path) {
    if (!path) return null;
    if (path.startsWith('http')) return path; // Si ya es una URL completa, no tocar
    if (path.startsWith('//')) return `https:${path}`; // Manejar protocolos relativos
    return `https://www.tikwm.com${path}`; // Añadir dominio si es un path relativo
}

// Endpoint Principal
router.get("/", async (req, res) => {
    try {
        const q = String(req.query.q || "").trim();
        const count = Math.min(Number(req.query.limit || 12), 30);

        if (!q) {
            return res.status(400).json({
                status: false,
                message: "Falta el parámetro de búsqueda: q"
            });
        }

        const url = "https://www.tikwm.com/api/feed/search";
        const r = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
            },
            body: new URLSearchParams({ 
                keywords: q, 
                count: count, 
                cursor: 0 
            })
        });

        const json = await r.json();

        if (!json || json.code !== 0 || !Array.isArray(json.data?.videos)) {
            return res.status(404).json({
                status: false,
                message: "No se encontraron resultados para: " + q
            });
        }

        const items = json.data.videos.map(v => ({
            id: v.video_id,
            title: v.title || "Sin título",
            type: (v.images && v.images.length > 0) ? "image_slideshow" : "video",
            // URLs corregidas aquí
            url: fixUrl(v.play || v.wmplay),
            cover: fixUrl(v.cover),
            origin_cover: fixUrl(v.origin_cover),
            images: Array.isArray(v.images) ? v.images.map(img => fixUrl(img)) : [],
            author: {
                username: v.author?.unique_id,
                nickname: v.author?.nickname,
                avatar: fixUrl(v.author?.avatar)
            },
            stats: {
                views: v.play_count,
                likes: v.digg_count,
                comments: v.comment_count,
                shares: v.share_count,
                downloads: v.download_count
            },
            music: {
                title: v.music_info?.title,
                author: v.music_info?.author,
                play_url: fixUrl(v.music_info?.play)
            }
        }));

        return res.json({
            status: true,
            creator: "NEXY",
            result: {
                query: q,
                total: items.length,
                items
            }
        });

    } catch (e) {
        return res.status(500).json({
            status: false,
            message: "Error interno en el buscador de TikTok: " + e.message
        });
    }
});

module.exports = { router };
