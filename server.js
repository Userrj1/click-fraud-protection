const express = require("express");
const fs = require("fs");

const app = express();

// Middleware to read data
app.use(express.json());
app.use(express.text());

let ipStore = {};
let blockedIPs = new Set();

// BLOCK middleware
app.use((req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  if (blockedIPs.has(ip)) {
    return res.status(403).send("Blocked");
  }

  next();
});

// Tracking endpoint
app.post("/track", (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  let data = {};

  try {
    if (typeof req.body === "string") {
      data = JSON.parse(req.body);
    } else {
      data = req.body;
    }
  } catch (e) {
    return res.sendStatus(200);
  }

  const { session_time, no_click, no_scroll } = data;

  // Ignore empty data
  if (!session_time) {
    return res.sendStatus(200);
  }

  let score = 0;
  const now = Date.now();

  // Rule 1
  if (session_time < 3 && no_click && no_scroll) {
    score += 80;
  }

  // Rule 2
  if (!ipStore[ip]) ipStore[ip] = [];
  ipStore[ip].push(now);

  ipStore[ip] = ipStore[ip].filter(t => now - t <= 20000);

  if (ipStore[ip].length > 3) {
    score += 80;
  }

  // Block condition
  if (score > 80) {
    blockedIPs.add(ip);

    const log = {
      ip,
      time: new Date(),
      session_time,
      score
    };

    fs.appendFileSync("blocked.json", JSON.stringify(log) + "\n");

    console.log("BLOCKED:", ip);
  }

  res.sendStatus(200);
});

// Start server
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
