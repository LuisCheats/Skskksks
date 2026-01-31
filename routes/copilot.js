"use strict";

const express = require("express");
const WebSocket = require("ws");
const axios = require("axios");
const router = express.Router();

/** Configuración de Modos */
const models = {
  default: 'chat',
  'think-deeper': 'reasoning',
  'gpt-5': 'smart'
};

const headers = {
  origin: 'https://copilot.microsoft.com',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

let conversationId = null;

async function createConversation() {
  const { data } = await axios.post('https://copilot.microsoft.com/c/api/conversations', null, { headers });
  conversationId = data.id;
  return conversationId;
}

async function copilotChat(text, mode = 'default') {
  if (!models[mode]) mode = 'default';
  if (!conversationId) await createConversation();

  return new Promise((resolve) => {
    const ws = new WebSocket(
      `wss://copilot.microsoft.com/c/api/chat?api-version=2&features=-,ncedge,edgepagecontext&setflight=-,ncedge,edgepagecontext&ncedge=1`,
      { headers }
    );

    const response = { text: '', citations: [] };

    ws.on('open', () => {
      ws.send(JSON.stringify({
        event: 'setOptions',
        supportedFeatures: ['partial-generated-images'],
        supportedCards: ['weather','image','video'],
        ads: { supportedTypes: ['text'] }
      }));

      ws.send(JSON.stringify({
        event: 'send',
        mode: models[mode],
        conversationId,
        content: [{ type: 'text', text }],
        context: {}
      }));
    });

    ws.on('message', (chunk) => {
      try {
        const parsed = JSON.parse(chunk.toString());
        if (parsed.event === 'appendText') response.text += parsed.text || '';
        if (parsed.event === 'citation') response.citations.push({ title: parsed.title, url: parsed.url });
        if (parsed.event === 'done') {
          resolve({ status: true, data: response });
          ws.close();
        }
      } catch (e) { /* ignore parse errors */ }
    });

    ws.on('error', () => resolve({ status: false, error: 'Error de conexión con Copilot' }));
    setTimeout(() => { ws.close(); resolve({ status: false, error: 'Tiempo de espera agotado' }); }, 30000);
  });
}

// Endpoint GET para tu explorador
router.get("/", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const mode = String(req.query.mode || "default").trim();

    if (!q) return res.status(400).json({ status: false, message: "Escribe una pregunta para Copilot" });

    const result = await copilotChat(q, mode);
    
    if (!result.status) return res.status(500).json({ status: false, message: result.error });

    res.json({
      status: true,
      creator: "NEXY",
      result: {
        query: q,
        mode: mode,
        answer: result.data.text,
        citations: result.data.citations
      }
    });
  } catch (e) {
    res.status(500).json({ status: false, message: e.message });
  }
});

module.exports = { router };
