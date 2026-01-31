"use strict";

const express = require("express");
const router = express.Router();

// --- CONFIGURACIÓN ---
const config = {
  name: "HD Image Enhance",
  icon: "ri-hd-line",
  route: "/tools/hd",
  category_id: 16,
};

// Endpoint Principal (Cambiado a GET para facilitar el uso desde el explorador)
router.get("/", (req, res) => {
  const url = req.query.url;
  
  if (!url) {
    return res.status(400).json({ 
        status: false, 
        message: "Falta el parámetro 'url' de la imagen" 
    });
  }

  const encoded = encodeURIComponent(url);
  // Parámetros: w=2000 (ancho), sharp=10 (enfoque), q=95 (calidad)
  const hdUrl = `https://images.weserv.nl/?url=${encoded}&w=2000&fit=inside&we&sharp=10&q=95`;

  res.json({
    status: true,
    creator: "Nexy",
    data: {
      image_hd: hdUrl,
      note: "Imagen procesada con escalado dinámico y enfoque (Sharpening)."
    }
  });
});

module.exports = { router };
