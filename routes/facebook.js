"use strict";

const express = require("express");
const router = express.Router();
const fetch = (...args) => import("node-fetch").then(m => m.default(...args));

function cleanFbUrl(str) {
    if (!str) return null;
    try {
        // Elimina escapes de barras y secuencias unicode
        return JSON.parse(`"${str}"`).replace(/\\/g, '');
    } catch {
        return str.replace(/\\u0025/g, '%').replace(/\\/g, '').replace(/&amp;/g, '&');
    }
}

function parseFacebook(html) {
    // Buscamos en las diferentes formas que FB guarda el video
    const sd = html.match(/"browser_native_sd_url":"(.*?)"/) || 
               html.match(/"playable_url":"(.*?)"/) ||
               html.match(/sd_src\s*:\s*"([^"]*)"/);

    const hd = html.match(/"browser_native_hd_url":"(.*?)"/) || 
               html.match(/"playable_url_quality_hd":"(.*?)"/) ||
               html.match(/hd_src\s*:\s*"([^"]*)"/);

    const title = html.match(/<meta\sname="description"\scontent="(.*?)"/i) || 
                  html.match(/<title>(.*?)<\/title>/i) ||
                  html.match(/"text":"(.*?)"/);

    const thumb = html.match(/"preferred_thumbnail":{"image":{"uri":"(.*?)"/) || 
                  html.match(/property="og:image"\s+content="([^"]+)"/i);

    if (!sd && !hd) return null;

    return {
        title: title ? title[1].split(' | ')[0] : "Facebook Reel",
        thumbnail: cleanFbUrl(thumb ? thumb[1] : ""),
        sd: cleanFbUrl(sd ? sd[1] : ""),
        hd: cleanFbUrl(hd ? hd[1] : "")
    };
}

router.get("/", async (req, res) => {
    let url = req.query.url;
    if (!url) return res.status(400).json({ status: false, message: "URL requerida" });

    // Limpiamos la URL de parámetros de rastreo (mibextid, etc) para evitar bloqueos
    const cleanUrl = url.split('?')[0];

    try {
        // Intentamos con cabeceras de navegador real
        const response = await fetch(cleanUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Accept-Language": "es-ES,es;q=0.9",
                "Sec-Fetch-Mode": "navigate"
            },
            redirect: 'follow'
        });
        
        const html = await response.text();
        let result = parseFacebook(html);

        // Si falla, reintentamos simulando un dispositivo móvil (Estrategia 2)
        if (!result) {
            const mobileResp = await fetch(cleanUrl.replace('www.', 'm.'), {
                headers: {
                    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
                }
            });
            const mobileHtml = await mobileResp.text();
            result = parseFacebook(mobileHtml);
        }

        if (!result) {
            return res.status(404).json({ 
                status: false, 
                message: "No se pudo extraer el video. Asegúrate de que el Reel sea público." 
            });
        }

        res.json({
            status: true,
            creator: "NEXY",
            result: {
                title: result.title,
                thumbnail: result.thumbnail,
                media: {
                    hd: result.hd || result.sd,
                    sd: result.sd || result.hd
                }
            }
        });
    } catch (e) {
        res.status(500).json({ status: false, message: e.message });
    }
});

module.exports = { router };
