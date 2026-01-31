"use strict";

const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const router = express.Router();

// Helper para limpiar nombres de archivos y evitar duplicados visuales
const safe = (s = "file") => {
    let name = String(s).trim();
    // Si el nombre viene duplicado (ej: archivo.ziparchivo.zip), lo cortamos a la mitad
    const mid = Math.floor(name.length / 2);
    if (name.length > 4 && name.substring(0, mid) === name.substring(mid)) {
        name = name.substring(0, mid);
    }
    return name.slice(0, 120).replace(/[^A-Za-z0-9_\-.]+/g, "_") || "file";
};

/* === SCRAPERS === */

async function parseFile(url) {
    try {
        const { data: html } = await axios.get(url, {
            timeout: 20000,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });
        const $ = cheerio.load(html);

        const download = $("#downloadButton").attr("href");
        if (!download) return null;

        // Selector ultra-preciso para evitar duplicidad
        let name = $(".dl-btn-label").attr("title") || $(".filename").first().text().trim();
        
        // Limpiar tamaño: quitamos "File" y "Size:"
        let size = $(".details li").first().text()
            .replace(/size:/i, "")
            .replace(/file/i, "")
            .trim();

        return [{
            name: name || "mediafire_file",
            size: size || "N/A",
            url: download
        }];
    } catch (e) { return null; }
}

async function parseFolder(url) {
    try {
        const { data: html } = await axios.get(url, { timeout: 20000 });
        const $ = cheerio.load(html);
        const files = [];

        $(".file").each((_, el) => {
            const link = $(el).find("a").attr("href");
            const name = $(el).find(".filename").text().trim();
            const size = $(el).find(".filesize").text().trim();

            if (link && name) {
                files.push({
                    name,
                    size,
                    url: link.startsWith("http") ? link : `https://www.mediafire.com${link}`
                });
            }
        });
        return files.length ? files : null;
    } catch (e) { return null; }
}

/* === API ENDPOINT === */

router.get("/", async (req, res) => {
    try {
        const url = String(req.query.url || "").trim();
        if (!url) return res.status(400).json({ status: false, message: "URL requerida" });
        if (!url.includes("mediafire.com")) return res.status(400).json({ status: false, message: "URL no válida" });

        let files = url.includes("/folder/") ? await parseFolder(url) : await parseFile(url);

        if (!files || files.length === 0) {
            return res.status(404).json({ status: false, message: "Archivo no encontrado o privado" });
        }

        const result = files.map(f => {
            const fileName = f.name;
            const safeName = safe(fileName);
            return {
                name: fileName,
                size: f.size,
                download: f.url
            };
        });

        res.json({
            status: true,
            creator: "NEXY",
            result: {
                total: result.length,
                files: result
            }
        });

    } catch (e) {
        res.status(500).json({ status: false, message: e.message });
    }
});

/* === PROXY DE DESCARGA === */

router.get("/dl", async (req, res) => {
    try {
        const src = String(req.query.src || "");
        const name = req.query.name || "file";

        if (!src) return res.status(400).send("Falta el parámetro src");

        const r = await axios.get(src, {
            responseType: "stream",
            headers: { "User-Agent": "Mozilla/5.0" }
        });

        res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
        res.setHeader("Content-Type", r.headers["content-type"] || "application/octet-stream");

        r.data.pipe(res);
    } catch (e) {
        res.status(500).send("Error en la descarga");
    }
});

module.exports = { router };
