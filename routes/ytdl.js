"use strict";

const express = require("express");
const router = express.Router();
const axios = require("axios");
const crypto = require("crypto");
const ytSearch = require("yt-search");

// --- CONFIGURACIÓN ---
const CONFIG = {
    REQUEST_TIMEOUT: 15000,
    MAX_RETRIES: 2
};

// Cache simple para el CDN
let cdnCache = {
    data: null,
    timestamp: 0
};

const savetube = {
    api: {
        base: 'https://media.savetube.me/api',
        info: '/v2/info',
        download: '/download',
        cdn: '/random-cdn',
    },
    headers: {
        'accept': '*/*',
        'content-type': 'application/json',
        'origin': 'https://yt.savetube.me',
        'referer': 'https://yt.savetube.me/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    crypto: {
        hexToBuffer: (hexString) => Buffer.from(hexString.match(/.{1,2}/g).join(''), 'hex'),
        decrypt: async (enc) => {
            const secretKey = 'C5D58EF67A7584E4A29F6C35BBC4EB12';
            const data = Buffer.from(enc, 'base64');
            const iv = data.slice(0, 16);
            const content = data.slice(16);
            const key = savetube.crypto.hexToBuffer(secretKey);
            const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
            let decrypted = Buffer.concat([decipher.update(content), decipher.final()]);
            try {
                return JSON.parse(decrypted.toString());
            } catch {
                return { title: 'Desconocido', duration: '??', key: null };
            }
        },
    },
    isUrl: (str) => {
        try {
            new URL(str);
            return /youtube.com|youtu.be/.test(str);
        } catch {
            return false;
        }
    },
    youtube: (url) => {
        const patterns = [
            /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
            /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
            /youtu\.be\/([a-zA-Z0-9_-]{11})/,
            /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
            /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
        ];
        for (let p of patterns) {
            if (p.test(url)) return url.match(p)[1];
        }
        return null;
    },
    request: async (endpoint, data = {}, method = 'post') => {
        try {
            const url = endpoint.startsWith('http') ? endpoint : `${savetube.api.base}${endpoint}`;
            const { data: res } = await axios({
                method,
                url,
                data: method === 'post' ? data : undefined,
                params: method === 'get' ? data : undefined,
                headers: savetube.headers,
                timeout: CONFIG.REQUEST_TIMEOUT,
            });
            return { status: true, data: res };
        } catch (err) {
            return { status: false, error: err.message };
        }
    },
    getCDN: async () => {
        if (cdnCache.data && Date.now() - cdnCache.timestamp < 300000) {
            return { status: true, data: cdnCache.data };
        }
        const r = await savetube.request(savetube.api.cdn, {}, 'get');
        if (!r.status) return r;
        cdnCache = { data: r.data.cdn, timestamp: Date.now() };
        return { status: true, data: r.data.cdn };
    },
    download: async (link, type = 'audio', quality = '360') => { 
        if (!savetube.isUrl(link)) return { status: false, error: 'URL inválida' };
        const id = savetube.youtube(link);
        if (!id) return { status: false, error: 'No se pudo obtener ID' };

        try {
            const cdnx = await savetube.getCDN();
            if (!cdnx.status) throw new Error('No se pudo obtener CDN');
            const cdn = cdnx.data;

            const info = await savetube.request(`https://${cdn}${savetube.api.info}`, {
                url: `https://www.youtube.com/watch?v=${id}`,
            });

            if (!info.status || !info.data?.data) throw new Error('No se pudo obtener info');
            const decrypted = await savetube.crypto.decrypt(info.data.data);
            if (!decrypted.key) throw new Error('No se pudo desencriptar clave');

            const downloadData = await savetube.request(`https://${cdn}${savetube.api.download}`, {
                id,
                downloadType: type === 'audio' ? 'audio' : 'video',
                quality: type === 'audio' ? '128' : quality,
                key: decrypted.key,
            });

            const url = downloadData.data?.data?.downloadUrl;
            if (!url) throw new Error('No se pudo generar enlace');

            return {
                status: true,
                result: {
                    title: decrypted.title || 'Desconocido',
                    download: url,
                    duration: decrypted.duration || '??',
                    quality: type === 'audio' ? '128kbps' : quality + 'p'
                },
            };
        } catch (err) {
            return { status: false, error: err.message };
        }
    }
};

// --- ROUTER ENDPOINT ---
router.get("/", async (req, res) => {
    const { url, type = 'audio', quality = '360' } = req.query;
    
    if (!url) return res.status(400).json({ status: 400, message: "URL required" });

    try {
        const videoId = savetube.youtube(url);
        if (!videoId) throw new Error("ID de YouTube inválido");

        // Obtenemos metadatos con yt-search para el thumbnail y canal
        const meta = await ytSearch({ videoId });

        // Intentar descarga con Savetube
        let result = await savetube.download(url, type, quality);

        // Reintento automático si falla el video en alta calidad
        if (!result.status && type === 'video' && quality !== '240') {
            result = await savetube.download(url, type, '240');
        }

        if (result.status) {
            res.json({
                status: 200,
                creator: "NEXY API",
                result: {
                    title: result.result.title || meta.title,
                    channel: meta.author.name,
                    duration: result.result.duration,
                    quality: result.result.quality,
                    thumbnail: meta.image,
                    download: result.result.download
                }
            });
        } else {
            throw new Error(result.error);
        }

    } catch (error) {
        res.status(500).json({ status: 500, creator: "NEXY API", message: error.message });
    }
});

module.exports = { router };
