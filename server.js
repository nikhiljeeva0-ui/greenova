const app = require('./api/index.js');

const PORT = process.env.PORT || 3000;

// Serve static files for local development only
const express = require('express');
app.use(express.static(__dirname, {
    extensions: ['html'],
    index: 'index.html'
}));

// Catch-all fallback for local dev (serve index.html for non-API routes)
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(require('path').join(__dirname, 'index.html'));
});

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
