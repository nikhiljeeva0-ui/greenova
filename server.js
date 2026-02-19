const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize data files if they don't exist
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

function initFile(filePath, defaultData) {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    }
}

// Default colleges with seed leaderboard data
const defaultSubmissions = [
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
        electricityHash: "demo-hash-001",
        solarHash: "demo-hash-002"
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
        electricityHash: "demo-hash-003",
        solarHash: "demo-hash-004"
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
        electricityHash: "demo-hash-005",
        solarHash: "demo-hash-006"
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
        electricityHash: "demo-hash-007",
        solarHash: "demo-hash-008"
    }
];

initFile(SUBMISSIONS_FILE, defaultSubmissions);
initFile(USERS_FILE, []);
initFile(SESSIONS_FILE, {});

// Helpers
function readJSON(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return filePath.endsWith('sessions.json') ? {} : [];
    }
}

function writeJSON(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files from project root
app.use(express.static(__dirname, {
    extensions: ['html'],
    index: 'index.html'
}));

// ─── API Routes ───

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Login (demo mode — any credentials work)
app.post('/api/login', (req, res) => {
    const { email, collegeId } = req.body;

    if (!email || !collegeId) {
        return res.status(400).json({ error: 'Email and college selection required' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const sessions = readJSON(SESSIONS_FILE);
    sessions[token] = {
        email,
        collegeId: parseInt(collegeId),
        createdAt: new Date().toISOString()
    };
    writeJSON(SESSIONS_FILE, sessions);

    res.json({
        success: true,
        token,
        message: 'Login successful',
        collegeId: parseInt(collegeId)
    });
});

// Submit energy data
app.post('/api/submit', (req, res) => {
    const { electricity, solar, carbonSaved, greenScore, collegeId, collegeName, electricityHash, solarHash, walletAddress } = req.body;

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

    const submissions = readJSON(SUBMISSIONS_FILE);
    submissions.push(submission);
    writeJSON(SUBMISSIONS_FILE, submissions);

    res.json({
        success: true,
        submission,
        message: `Data submitted! Earned ${tokens} Carbon Tokens.`
    });
});

// Leaderboard — aggregate by college, return best score per college
app.get('/api/leaderboard', (req, res) => {
    const submissions = readJSON(SUBMISSIONS_FILE);

    // Group by collegeName, keep the latest submission per college
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
    const submissions = readJSON(SUBMISSIONS_FILE);
    const collegeId = parseInt(req.params.collegeId);
    const filtered = submissions
        .filter(s => s.collegeId === collegeId)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({ success: true, submissions: filtered });
});

// Catch-all: serve index.html for SPA-like navigation
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════╗
║   ⚡ CampusCarbon Server Running        ║
║   🌐 http://localhost:${PORT}              ║
║   📊 API: http://localhost:${PORT}/api     ║
║   🌿 Environment: development           ║
╚══════════════════════════════════════════╝
    `);
});
