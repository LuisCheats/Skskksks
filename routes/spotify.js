"use strict";

const express = require("express");
const axios = require("axios");
const router = express.Router();

// Credenciales (Mantenemos las tuyas)
const SPOTIFY_CLIENT_ID = "a1f723497d3044a3af130576e60cf7bc";
const SPOTIFY_CLIENT_SECRET = "16f0d1aa9c3f4b60b1dc153e1021958a";

let spToken = null;
let spTokenExp = 0;

/**
 * Obtiene o refresca el Token de Spotify
 */
async function getSpotifyToken() {
  if (spToken && Date.now() < spTokenExp) return spToken;

  const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");

  const { data } = await axios.post("https://accounts.spotify.com/api/token", "grant_type=client_credentials", {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      }
    }
  );

  spToken = data.access_token;
  spTokenExp = Date.now() + data.expires_in * 1000 - 60000;
  return spToken;
}

// Endpoint Principal: GET /api/search/spotify?q=...
router.get("/", async (req, res) => {
  try {
    const query = String(req.query.q || "").trim();
    if (!query) {
      return res.status(400).json({ status: false, message: "Falta el parámetro de búsqueda (q)" });
    }

    const token = await getSpotifyToken();

    const { data } = await axios.get("https://api.spotify.com/v1/search", {
        params: { q: query, type: "track", limit: 12 },
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    const results = (data.tracks.items || []).map(t => ({
      id: t.id,
      title: t.name,
      artists: t.artists.map(a => a.name).join(", "),
      album: t.album.name,
      release_date: t.album.release_date,
      duration: (t.duration_ms / 1000 / 60).toFixed(2) + " min",
      cover: t.album.images?.[0]?.url || null,
      preview: t.preview_url, // URL de 30 seg de audio si está disponible
      spotify_url: t.external_urls.spotify
    }));

    res.json({
      status: true,
      creator: "NEXY",
      result: {
        query,
        total: results.length,
        items: results
      }
    });
  } catch (e) {
    res.status(500).json({
      status: false,
      message: "Error en Spotify Search",
      error: e.response?.data?.error?.message || e.message
    });
  }
});

module.exports = { router };
