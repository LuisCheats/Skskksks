"use strict";

const express = require("express");
const router = express.Router();
const { Readable } = require("stream");
const axios = require("axios");
const { wrapper } = require("axios-cookiejar-support");
const { CookieJar } = require("tough-cookie");

// --- CONFIGURACIÓN ---
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// -------------------- HELPERS --------------------
function guessTypeFromUrl(u = "") {
    if (/\.mp4(\?|$)/i.test(u)) return "video";
    if (/(\.jpg|\.jpeg|\.png|\.webp)(\?|$)/i.test(u)) return "image";
    return "file";
}

function extractUrlsFromUnknown(data) {
    const out = new Set();
    const walk = (v) => {
        if (!v) return;
        if (typeof v === "string") {
            if (/^https?:\/\//i.test(v)) out.add(v);
            return;
        }
        if (Array.isArray(v)) {
            v.forEach(walk);
            return;
        }
        if (typeof v === "object") {
            for (const k of Object.keys(v)) walk(v[k]);
            return;
        }
    };
    walk(data);
    return Array.from(out).filter(u => /(\.mp4|\.jpg|\.jpeg|\.png|\.webp)(\?|$)/i.test(u));
}

// -------------------- SCRAPER CORE --------------------
let tokenCache = { cookies: "", token: "", exp: 0 };

async function getToken() {
    if (tokenCache.token && Date.now() < tokenCache.exp) {
        return { cookies: tokenCache.cookies, token: tokenCache.token };
    }

    const jar = new CookieJar();
    const client = wrapper(axios.create({ jar, withCredentials: true, timeout: 20000 }));

    const base = "https://instasaved.net/en";
    await client.get(base);
    
    const cookiesStr = await jar.getCookieString(base);
    const cookiesAll = await jar.getCookies(base);
    const xsrf = cookiesAll.find((c) => c.key === "XSRF-TOKEN");
    const token = xsrf ? decodeURIComponent(xsrf.value) : "";

    tokenCache = { cookies: cookiesStr, token, exp: Date.now() + 6 * 60 * 1000 };
    return { cookies: cookiesStr, token };
}

async function instasavedFetch(instaUrl) {
    const { cookies, token } = await getToken();
    const headers = {
        "User-Agent": UA,
        "Cookie": cookies,
        "X-XSRF-TOKEN": token,
        "Origin": "https://instasaved.net",
        "Referer": "https://instasaved.net/en",
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/json"
    };

    const { data } = await axios.post(
        "https://instasaved.net/en/ajax/saver",
        { origin_value: instaUrl, type: "post" },
        { headers }
    );
    return data;
}

// -------------------- RUTAS --------------------

// Endpoint Principal
router.get("/", async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ status: false, message: "Falta la URL" });

    try {
        const data = await instasavedFetch(url);
        const urls = extractUrlsFromUnknown(data);

        if (!urls.length) {
            return res.status(404).json({ status: false, message: "No se encontraron medios" });
        }

        const items = urls.map(u => ({
            type: guessTypeFromUrl(u),
            url: u
        }));

        res.json({
            creator: "NEXY",
            status: true,
            media: items
        });
    } catch (e) {
        res.status(500).json({ status: false, message: e.message });
    }
});

// Exportación compatible con tu index.js
module.exports = { router };
