const express = require('express');
const crypto = require('crypto');

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));

// CORS for Vercel
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

// ═══════════════════════════════════════
// In-Memory Data Store (Serverless-safe)
// Vercel serverless has NO persistent filesystem
// ═══════════════════════════════════════

// In-memory stores (reset on cold start — acceptable for demo/hackathon)
// No seed/dummy data — starts empty, populated by real submissions
let submissions = [];
let sessions = {};

// ─── API Routes ───

// Health check
app.get('/api/health', (req, res) => {
    // Check required environment variables
    const appId = process.env.APP_ID || '';
    const algodServer = process.env.ALGOD_SERVER || '';
    const algodToken = process.env.ALGOD_TOKEN || '';

    if (!appId || !algodServer) {
        console.warn("WARNING: Missing essential Render environment variables (APP_ID, ALGOD_SERVER)");
    }

    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        platform: 'vercel-serverless',
        envConfigured: !!(appId && algodServer)
    });
});

// Login (demo — any credentials work)
app.post('/api/login', (req, res) => {
    const { email, collegeName } = req.body;

    if (!email || !collegeName) {
        return res.status(400).json({ error: 'Email and college name required' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    sessions[token] = {
        email,
        collegeName: collegeName.trim(),
        createdAt: new Date().toISOString()
    };

    res.json({
        success: true,
        token,
        message: 'Login successful',
        collegeName: collegeName.trim()
    });
});

// Submit energy data
app.post('/api/submit', (req, res) => {
    const {
        electricity, solar, carbonSaved, greenScore,
        collegeName, electricityHash, solarHash, walletAddress
    } = req.body;

    // Validation
    if (!electricity || electricity <= 0) {
        return res.status(400).json({ error: 'Valid electricity value required' });
    }
    if (solar < 0) {
        return res.status(400).json({ error: 'Solar value cannot be negative' });
    }
    if (solar > electricity) {
        return res.status(400).json({ error: 'Solar generation cannot exceed electricity usage' });
    }
    if (electricity > 50000) {
        return res.status(400).json({ error: 'Electricity exceeds realistic campus cap (50,000 kWh)' });
    }
    if (!collegeName || !collegeName.trim()) {
        return res.status(400).json({ error: 'College name is required' });
    }

    const tokens = Math.floor((carbonSaved || 0) / 100);
    const submission = {
        id: crypto.randomUUID(),
        collegeName: collegeName.trim(),
        electricity: parseFloat(electricity),
        solar: parseFloat(solar),
        carbonSaved: parseFloat(carbonSaved) || 0,
        greenScore: parseFloat(greenScore) || 0,
        tokens,
        timestamp: new Date().toISOString(),
        electricityHash: electricityHash || null,
        solarHash: solarHash || null,
        walletAddress: walletAddress || null
    };

    submissions.push(submission);

    res.json({
        success: true,
        submission,
        message: `Data submitted! Earned ${tokens} Carbon Tokens.`
    });
});

// Leaderboard — aggregate best score per college
app.get('/api/leaderboard', (req, res) => {
    const collegeMap = {};
    submissions.forEach(s => {
        const key = s.collegeName;
        if (!collegeMap[key] || new Date(s.timestamp) > new Date(collegeMap[key].timestamp)) {
            collegeMap[key] = s;
        }
    });

    const leaderboard = Object.values(collegeMap)
        .map(s => ({
            collegeName: s.collegeName,
            greenScore: s.greenScore,
            carbonSaved: s.carbonSaved,
            electricity: s.electricity,
            solar: s.solar,
            tokens: s.tokens,
            lastUpdated: s.timestamp
        }))
        .sort((a, b) => b.greenScore - a.greenScore);

    res.json({ success: true, leaderboard });
});

// Get submissions for a specific college
app.get('/api/submissions/:collegeName', (req, res) => {
    const name = decodeURIComponent(req.params.collegeName);
    const filtered = submissions
        .filter(s => s.collegeName.toLowerCase() === name.toLowerCase())
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({ success: true, submissions: filtered });
});

// Catch-all API 404
app.all('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
});

module.exports = app;
