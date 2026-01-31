const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');
require("./function.js"); // Carga las funciones globales

const app = express();

// Vercel asigna el puerto automáticamente, pero mantenemos tu variable por compatibilidad local
const PORT = process.env.PORT || 30043;

// Importar los routers de las rutas
const { router: ytMp3Route } = require('./routes/ytmp3');
const { router: ytMp4Route } = require('./routes/ytmp4');
const { router: ytdlRoute } = require('./routes/ytdl'); 
const { router: pinRoute } = require('./routes/pinterest');
const { router: tiktokRoute } = require('./routes/tiktok');
const xnxxRoute = require('./routes/xnxx'); 
const { router: instagramRoute } = require('./routes/instagram');
const { router: pinVideoRoute } = require('./routes/pinterestv');
const { router: hdRoute } = require('./routes/hd');
const { router: tiktokSearchRoute } = require('./routes/tiktoks');
const { router: copilotRoute } = require('./routes/copilot');
const { router: mediafireRoute } = require('./routes/mediafire');
const { router: facebookRoute } = require('./routes/facebook');
const { router: spotifySearchRoute } = require('./routes/spotify');
const { router: twitterRoute } = require('./routes/twitter');
const { router: youtubeV2Route } = require('./routes/ytdl2');
const ytdlv3 = require('./routes/ytdl3');

app.use(express.json());

// Ajuste de ruta estática para Vercel (apunta a la raíz desde la carpeta api/)
app.use(express.static(path.join(process.cwd(), 'public')));

// --- CONFIGURACIÓN DE ENDPOINTS ---
app.use('/api/dl/ytmp3', ytMp3Route);
app.use('/api/dl/ytmp4', ytMp4Route);
app.use('/api/dl/ytdl', ytdlRoute); 
app.use('/api/dl/pinterest', pinRoute);
app.use('/api/dl/tiktok', tiktokRoute);
app.use('/api/nsfw/xnxx', xnxxRoute);
app.use('/api/dl/instagram', instagramRoute);
app.use('/api/dl/pinvideo', pinVideoRoute);
app.use('/api/tools/hd', hdRoute);
app.use('/api/search/tiktok', tiktokSearchRoute);
app.use('/api/ai/copilot', copilotRoute);
app.use('/api/dl/mediafire', mediafireRoute);
app.use('/api/dl/facebook', facebookRoute);
app.use('/api/search/spotify', spotifySearchRoute);
app.use('/api/dl/twitter', twitterRoute);
app.use('/api/dl/ytdlv2', youtubeV2Route);
app.use('/api/dl/ytdlv3', ytdlv3.router);

// Rutas de navegación del Frontend (usando process.cwd() para asegurar la ruta en Vercel)
app.get('/', (req, res) => res.sendFile(path.join(process.cwd(), 'public', 'index.html')));
app.get('/v1', (req, res) => res.sendFile(path.join(process.cwd(), 'public', 'api.html')));
app.get('/doc', (req, res) => res.sendFile(path.join(process.cwd(), 'public', 'doc.html')));
app.get('/api', (req, res) => res.sendFile(path.join(process.cwd(), 'public', 'api.html')));

// Manejo de Error 404
app.use((req, res) => {
    res.status(404).sendFile(path.join(process.cwd(), 'public', '404.html'));
});

// Inicio del servidor (Solo para desarrollo local, Vercel ignora el .listen)
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`\x1b[36m> NEXY CORE ONLINE | PORT: ${PORT}\x1b[0m`);
        console.log(`\x1b[32m> ENDPOINTS CARGADOS CORRECTAMENTE\x1b[0m`);
    });
}

// Exportar la app para que Vercel la maneje
module.exports = app;
