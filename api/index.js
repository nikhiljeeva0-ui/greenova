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
const seedSubmissions = [
    {
        id: "seed-1",
        collegeId: 1,
        collegeName: "Green Valley Institute",
        electricity: 1200,
        solar: 600,
        carbonSaved: 492,
        greenScore: 82,
        tokens: 4,
        timestamp: new Date().toISOString(),
        electricityHash: "a1b2c3d4e5f6789012345678abcdef0123456789abcdef0123456789abcdef01",
        solarHash: "b2c3d4e5f6789012345678abcdef0123456789abcdef0123456789abcdef0102"
    },
    {
        id: "seed-2",
        collegeId: 2,
        collegeName: "Tech City College",
        electricity: 1800,
        solar: 500,
        carbonSaved: 410,
        greenScore: 65,
        tokens: 4,
        timestamp: new Date().toISOString(),
        electricityHash: "c3d4e5f6789012345678abcdef0123456789abcdef0123456789abcdef010203",
        solarHash: "d4e5f6789012345678abcdef0123456789abcdef0123456789abcdef01020304"
    },
    {
        id: "seed-3",
        collegeId: 3,
        collegeName: "Metro University",
        electricity: 2200,
        solar: 400,
        carbonSaved: 328,
        greenScore: 45,
        tokens: 3,
        timestamp: new Date().toISOString(),
        electricityHash: "e5f6789012345678abcdef0123456789abcdef0123456789abcdef0102030405",
        solarHash: "f6789012345678abcdef0123456789abcdef0123456789abcdef010203040506"
    },
    {
        id: "seed-4",
        collegeId: 4,
        collegeName: "North Hills Academy",
        electricity: 900,
        solar: 700,
        carbonSaved: 574,
        greenScore: 91,
        tokens: 5,
        timestamp: new Date().toISOString(),
        electricityHash: "789012345678abcdef0123456789abcdef0123456789abcdef01020304050607",
        solarHash: "89012345678abcdef0123456789abcdef0123456789abcdef0102030405060708"
    }
];

// In-memory stores (reset on cold start — acceptable for demo/hackathon)
let submissions = [...seedSubmissions];
let sessions = {};

// ─── API Routes ───

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        platform: 'vercel-serverless'
    });
});

// Login (demo — any credentials work)
app.post('/api/login', (req, res) => {
    const { email, collegeId } = req.body;

    if (!email || !collegeId) {
        return res.status(400).json({ error: 'Email and college selection required' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    sessions[token] = {
        email,
        collegeId: parseInt(collegeId),
        createdAt: new Date().toISOString()
    };

    res.json({
        success: true,
        token,
        message: 'Login successful',
        collegeId: parseInt(collegeId)
    });
});

// Submit energy data
app.post('/api/submit', (req, res) => {
    const {
        electricity, solar, carbonSaved, greenScore,
        collegeId, collegeName, electricityHash, solarHash, walletAddress
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

    const tokens = Math.floor((carbonSaved || 0) / 100);
    const submission = {
        id: crypto.randomUUID(),
        collegeId: parseInt(collegeId) || 1,
        collegeName: collegeName || 'Unknown Campus',
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
            collegeId: s.collegeId,
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
app.get('/api/submissions/:collegeId', (req, res) => {
    const collegeId = parseInt(req.params.collegeId);
    const filtered = submissions
        .filter(s => s.collegeId === collegeId)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({ success: true, submissions: filtered });
});

// Catch-all API 404
app.all('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
});

// ═══════════════════════════════════════
// Export for Vercel Serverless Functions
// NO app.listen() — Vercel handles this!
// ═══════════════════════════════════════
module.exports = app;
