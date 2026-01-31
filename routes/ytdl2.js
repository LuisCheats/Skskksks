"use strict";

const express = require("express");
const router = express.Router();
const { Readable } = require("stream");

// --- SERVICIOS ORIGINALES INTEGRADOS ---

const Services = {
    // Servicio: ogmp3 / savenow
    async ogmp3(url, format) {
        const h = { "User-Agent": "Mozilla/5.0", "Referer": "https://y2down.cc/" };
        const api = "dfcb6d76f2f6a9894gjkege8a4ab232222";
        const init = await fetch(`https://p.savenow.to/ajax/download.php?copyright=0&format=${format}&url=${encodeURIComponent(url)}&api=${api}`, { headers: h }).then(r => r.json());
        if (!init.success) throw new Error();
        for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const p = await fetch(`https://p.savenow.to/api/progress?id=${init.id}`, { headers: h }).then(r => r.json());
            if (p.progress === 1000 && p.download_url) return p.download_url;
        }
        throw new Error();
    },

    // Servicio: yt-savetube
    async savetube(url, type, quality) {
        const res = await fetch(`https://api.savetube.me/info?url=${encodeURIComponent(url)}`).then(r => r.json());
        if (!res.status) throw new Error();
        const key = type === "audio" ? res.result.audio[0].key : (res.result.video.find(v => v.quality == quality)?.key || res.result.video[0].key);
        const dl = await fetch(`https://api.savetube.me/download?key=${key}`).then(r => r.json());
        return dl.result.url;
    },

    // Servicio: ytdl-amdl (Y2Mate Engine)
    async amdl(url, type, quality) {
        const headers = { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0" };
        const analyze = await fetch("https://www.y2mate.com/mates/en942/analyzeV2/ajax", {
            method: "POST",
            headers,
            body: `k_query=${encodeURIComponent(url)}&k_page=home&hl=en&q_auto=0`
        }).then(r => r.json());
        
        const qKey = type === "audio" ? "mp3128" : (quality || "360");
        const formats = type === "audio" ? analyze.links.mp3 : analyze.links.mp4;
        const key = formats[qKey]?.k || formats[Object.keys(formats)[0]].k;

        const convert = await fetch("https://www.y2mate.com/mates/en942/convertV2/ajax", {
            method: "POST",
            headers,
            body: `vid=${analyze.vid}&k=${encodeURIComponent(key)}`
        }).then(r => r.json());
        return convert.dlink;
    }
};

// --- PROXY DE DESCARGA ---
router.get("/dl", async (req, res) => {
    const { src, filename, download } = req.query;
    try {
        const up = await fetch(src, { headers: { "User-Agent": "Mozilla/5.0" } });
        res.setHeader("Content-Type", up.headers.get("content-type") || "application/octet-stream");
        res.setHeader("Content-Disposition", `${download === "1" ? "attachment" : "inline"}; filename="${encodeURIComponent(filename)}"`);
        Readable.fromWeb(up.body).pipe(res);
    } catch (e) { res.status(500).send("Stream Error"); }
});

// --- ENDPOINT PRINCIPAL (GET) ---
router.get("/", async (req, res) => {
    const { url, type, quality } = req.query;
    if (!url) return res.status(400).json({ status: false, message: "URL is required" });

    const t = type || "video";
    const q = t === "audio" ? "mp3" : (quality || "360");

    try {
        let direct = null;
        
        // CASCADA DE SERVICIOS ORIGINALES
        try { 
            direct = await Services.ogmp3(url, q); 
        } catch (e) {
            try { 
                direct = await Services.savetube(url, t, q); 
            } catch (e) {
                direct = await Services.amdl(url, t, q);
            }
        }

        if (!direct) throw new Error("All services failed");

        const meta = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`).then(r => r.json()).catch(() => ({}));
        const cleanTitle = (meta.title || "video").replace(/[^a-zA-Z0-9]/g, "_");
        const filename = `${cleanTitle}.${t === "audio" ? "mp3" : "mp4"}`;
        
        // Link del Proxy local
        const proxyPath = `/api/dl/ytdlv2/dl?src=${encodeURIComponent(direct)}&filename=${encodeURIComponent(filename)}`;

        res.json({
            status: true,
            result: {
                title: meta.title || "YouTube Download",
                thumbnail: meta.thumbnail_url,
                media: {
                    direct: direct,
                    dl_inline: proxyPath,
                    dl_download: proxyPath + "&download=1"
                }
            }
        });

    } catch (e) {
        res.status(500).json({ status: false, message: "Error procesando la solicitud" });
    }
});

module.exports = { router };
