"use strict";

const express = require("express");
const router = express.Router();
const axios = require("axios");
const crypto = require("crypto");
const yts = require("yt-search");

const Services = {
    async savetube(url, type) {
        const id = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([^?&"'>]+)/)?.[1];
        if (!id) throw new Error();
        const cdnRes = await axios.get('https://media.savetube.me/api/v2/random-cdn');
        const cdn = cdnRes.data.cdn;
        const infoRes = await axios.post(`https://${cdn}/api/v2/info`, { url: `https://www.youtube.com/watch?v=${id}` });
        const secretKey = 'C5D58EF67A7584E4A29F6C35BBC4EB12';
        const data = Buffer.from(infoRes.data.data, 'base64');
        const decipher = crypto.createDecipheriv('aes-128-cbc', Buffer.from(secretKey, 'hex'), data.slice(0, 16));
        const decrypted = JSON.parse(Buffer.concat([decipher.update(data.slice(16)), decipher.final()]).toString());
        const dlRes = await axios.post(`https://${cdn}/api/v2/download`, {
            id,
            downloadType: type === 'mp3' ? 'audio' : 'video',
            quality: type === 'mp3' ? '128' : '360',
            key: decrypted.key
        });
        return { link: dlRes.data.data.downloadUrl, server: 'Nexy XZ' };
    },

    async yt2dow(url, type) {
        const format = type === 'mp3' ? 'mp3' : '360';
        const init = await axios.get(`https://p.savenow.to/ajax/download.php?copyright=0&format=${format}&url=${encodeURIComponent(url)}&api=dfcb6d76f2f6a9894gjkege8a4ab232222`, {
            headers: { 'Referer': 'https://y2down.cc/' }
        });
        for (let i = 0; i < 12; i++) {
            await new Promise(r => setTimeout(r, 1500));
            const progress = await axios.get(`https://p.savenow.to/api/progress?id=${init.data.id}`);
            if (progress.data.progress === 1000 && progress.data.download_url) {
                return { link: progress.data.download_url, server: 'Nexy Luxury' };
            }
        }
        throw new Error();
    },

    async ytmp3gg(url) {
        const res = await axios.post('https://hub.y2mp3.co/', {
            url,
            downloadMode: "audio",
            brandName: "ytmp3.gg",
            audioFormat: "mp3",
            audioBitrate: "128"
        });
        return { link: res.data.url, server: 'Nexy Ar7z' };
    }
};

router.get("/", async (req, res) => {
    const { url, type } = req.query;
    if (!url) return res.status(400).json({ status: false, message: "Falta URL" });

    const format = type === 'mp3' ? 'mp3' : 'mp4';

    try {
        const search = await yts(url);
        const video = search.videos[0] || {};

        const tasks = [
            Services.savetube(url, format),
            Services.yt2dow(url, format)
        ];
        if (format === 'mp3') tasks.push(Services.ytmp3gg(url));

        const winner = await Promise.any(tasks);

        res.json({
            status: true,
            creator: "Nexy",
            result: {
                title: video.title || "YouTube Video",
                id: video.videoId,
                duration: video.timestamp,
                views: video.views,
                ago: video.ago,
                author: video.author?.name,
                thumbnail: video.thumbnail,
                url: video.url,
                download: winner.link,
                server: winner.server
            }
        });
    } catch (e) {
        res.status(500).json({ status: false, message: "Error en carrera de servidores" });
    }
});

module.exports = { router };
