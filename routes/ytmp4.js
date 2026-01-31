"use strict";

const express = require("express");
const router = express.Router();
const axios = require("axios");
const ytSearch = require("yt-search");

// Helper para obtener el link de descarga desde Savenow
async function getDownloadLink(videoUrl, quality) {
    const apiKey = "dfcb6d76f2f6a9894gjkege8a4ab232222";
    const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://y2down.cc/",
        "Accept": "application/json"
    };

    // 1. Iniciar tarea
    const initUrl = `https://p.savenow.to/ajax/download.php?copyright=0&format=${quality}&url=${encodeURIComponent(videoUrl)}&api=${apiKey}`;
    const { data: initData } = await axios.get(initUrl, { headers });

    if (!initData.success || !initData.id) throw new Error("No se pudo iniciar la conversión");

    // 2. Poll de progreso
    const progressUrl = `https://p.savenow.to/api/progress?id=${initData.id}`;
    for (let i = 0; i < 30; i++) { // Reintenta por 60 segundos aprox
        await new Promise(r => setTimeout(r, 2000));
        const { data: progData } = await axios.get(progressUrl, { headers });
        if (Number(progData.progress) === 1000 && progData.download_url) {
            return progData.download_url;
        }
    }
    throw new Error("Tiempo de espera agotado");
}

router.get("/", async (req, res) => {
    const { url, quality = "360" } = req.query;
    if (!url) return res.status(400).json({ status: 400, message: "URL required" });

    try {
        const videoId = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([^& \n]+)/)?.[1];
        if (!videoId) throw new Error("ID no encontrado");

        // Obtener metadatos reales
        const info = await ytSearch({ videoId: videoId });

        // Obtener el enlace MP4 real
        const downloadUrl = await getDownloadLink(url, quality);

        res.json({
            status: 200,
            creator: "NEXY API",
            result: {
                title: info.title,
                channel: info.author.name,
                type: "video",
                format: "mp4",
                quality: quality + "p",
                duration: info.timestamp,
                thumbnail: info.image,
                download: downloadUrl
            }
        });

    } catch (error) {
        res.status(500).json({ status: 500, creator: "NEXY API", message: error.message });
    }
});

module.exports = { router };
