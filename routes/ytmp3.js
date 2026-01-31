"use strict";

const express = require("express");
const router = express.Router();
const axios = require("axios");
const ytSearch = require("yt-search");

async function scrapeYoutube(urlVideo) {
    try {
        const videoId = urlVideo.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([^& \n]+)/)?.[1];
        if (!videoId) throw new Error("ID no encontrado");

        const info = await ytSearch({ videoId: videoId });
        
        const res = await axios.post("https://hub.y2mp3.co/", {
            url: urlVideo,
            downloadMode: "audio",
            brandName: "ytmp3.gg",
            audioFormat: "mp3",
            audioBitrate: "128"
        }, { headers: { "Content-Type": "application/json" } });

        return {
            status: 200,
            creator: "NEXY API",
            result: {
                title: info.title,
                channel: info.author.name,
                type: "audio",
                format: "mp3",
                quality: "128",
                duration: info.timestamp,
                thumbnail: info.image,
                download: res.data.url
            }
        };
    } catch (error) {
        return { status: 500, creator: "NEXY API", message: error.message };
    }
}

router.get("/", async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ status: 400, message: "URL required" });
    const data = await scrapeYoutube(url);
    res.json(data);
});

module.exports = { router };
