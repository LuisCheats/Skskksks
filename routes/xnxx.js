"use strict";

const express = require("express");
const router = express.Router();
const axios = require("axios");
const cheerio = require("cheerio");

const UA = "Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.5845.163 Mobile Safari/537.36";

// --- FUNCIONES DE UTILIDAD (Tus funciones originales) ---

function unescapeSlashes(s) {
  return String(s || "").replace(/\\\//g, "/");
}

function absUrl(base, rel) {
  try {
    return new URL(rel, base).toString();
  } catch {
    return null;
  }
}

function uniq(arr) {
  return [...new Set((arr || []).filter(Boolean))];
}

function isM3u8(u) {
  return /\.m3u8(\?|#|$)/i.test(String(u || ""));
}

async function getText(url, { headers = {} } = {}) {
  const r = await axios.get(url, {
    responseType: "text",
    headers: {
      "user-agent": UA,
      accept: "*/*",
      "accept-language": "es-ES,es;q=0.9,en;q=0.8",
      ...headers,
    },
    timeout: 20000,
    maxRedirects: 5,
    validateStatus: () => true,
  });

  const text = typeof r.data === "string" ? r.data : "";
  const ok = r.status >= 200 && r.status < 400 && text.length > 0;
  return { ok, status: r.status, text };
}

function extractVideoKeyFromUrl(pageUrl) {
  const s = String(pageUrl || "");
  const m = s.match(/\/video-([a-z0-9_]+)\b/i);
  return m ? m[1] : null;
}

function extractHlsLoadedFromHtml(html) {
  const m = html.match(/\/html5player\/hls_loaded\/([a-z0-9_]+)\/(\d+)\/?/i);
  if (!m) return null;
  return { videoKey: m[1], cdnId: Number(m[2]) };
}

function extractAllM3u8FromHtml(html) {
  const out = [];
  const reAbs = /https?:\/\/[^\s"'<>\\]+?\.m3u8(?:\?[^\s"'<>\\]*)?/gi;
  (html.match(reAbs) || []).forEach((u) => out.push(unescapeSlashes(u)));

  const reEsc = /https?:\\\/\\\/[^\s"'<>]+?\.m3u8(?:\?[^\s"'<>]*)?/gi;
  (html.match(reEsc) || []).forEach((u) => out.push(unescapeSlashes(u)));

  return uniq(out);
}

function pickMaster(m3u8s) {
  const list = uniq(m3u8s);
  return (
    list.find((u) => /\/hls\.m3u8/i.test(u)) ||
    list.find((u) => /\/videos\/hls\//i.test(u)) ||
    list[0] ||
    null
  );
}

function parseMasterPickBest(masterText, masterUrl) {
  const lines = masterText.split("\n").map((x) => x.trim());
  const variants = [];

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith("#EXT-X-STREAM-INF")) continue;

    const attrs = {};
    lines[i]
      .replace("#EXT-X-STREAM-INF:", "")
      .split(",")
      .forEach((p) => {
        const [k, v] = p.split("=");
        if (k && v) attrs[k.trim()] = v.replace(/"/g, "");
      });

    const uri = lines[i + 1];
    if (!uri || uri.startsWith("#")) continue;

    const res = attrs.RESOLUTION || "";
    const h = res.includes("x") ? Number(res.split("x")[1]) : 0;

    variants.push({
      url: absUrl(masterUrl, uri),
      height: h,
      bw: Number(attrs.BANDWIDTH) || 0,
    });
  }

  variants.sort((a, b) => b.height - a.height || b.bw - a.bw);
  return variants[0] ? variants[0].url : null;
}

function pickTitleAndThumb(html) {
  const $ = cheerio.load(html);
  const title = $('meta[property="og:title"]').attr("content") || $("title").text() || null;
  const thumbnail = $('meta[property="og:image"]').attr("content") || null;
  return { title, thumbnail };
}

async function scrapeBest({ pageUrl }) {
  if (!pageUrl || isM3u8(pageUrl)) {
    throw new Error("Pasa una URL válida del video");
  }

  const page = await getText(pageUrl, { headers: { referer: pageUrl } });
  if (!page.ok) return { ok: false, problem: "No HTML o error de red" };

  const html = page.text;
  const { title, thumbnail } = pickTitleAndThumb(html);

  const key = extractHlsLoadedFromHtml(html)?.videoKey || extractVideoKeyFromUrl(pageUrl);
  if (!key) return { ok: false, problem: "No se encontró la llave del video" };

  const m3u8s = extractAllM3u8FromHtml(html);
  const master = pickMaster(m3u8s);
  if (!master) return { ok: false, problem: "No se encontraron archivos m3u8" };

  const masterRes = await getText(master, { headers: { referer: pageUrl } });

  // Si el m3u8 es un master, elige la mejor calidad, si no, usa el master original
  const best = (masterRes.ok) ? (parseMasterPickBest(masterRes.text, master) || master) : master;

  return {
    creator: "NEXY",
    status: true,
    title,
    thumbnail,
    url: best,
  };
}

// --- ENDPOINT DE EXPRESS ---

router.get("/", async (req, res) => {
  const videoUrl = req.query.url;

  if (!videoUrl) {
    return res.status(400).json({
      creator: "NEXY",
      status: false,
      message: "Falta el parámetro 'url'"
    });
  }

  try {
    const result = await scrapeBest({ pageUrl: videoUrl });
    res.json(result);
  } catch (error) {
    res.status(500).json({
      creator: "NEXY",
      status: false,
      message: error.message
    });
  }
});

module.exports = router; // Sin llaves { }

