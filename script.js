// ═══════════════════════════════════════
// CampusCarbon — Production Script
// ═══════════════════════════════════════

// Debug logging
function debugLog() {
    const cfg = (typeof window !== 'undefined' && window.CAMPUS_CARBON_CONFIG) ? window.CAMPUS_CARBON_CONFIG : {};
    if (!cfg.DEBUG || typeof console === 'undefined') return;
    const args = Array.prototype.slice.call(arguments);
    if (args[0] === 'error' && console.error) console.error.apply(console, args.slice(1));
    else if (args[0] === 'warn' && console.warn) console.warn.apply(console, args.slice(1));
    else if (console.log) console.log.apply(console, args);
}

// XSS protection
function escapeHtml(str) {
    if (str == null || typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Validate logo URL
function safeLogoUrl(url) {
    if (!url || typeof url !== 'string') return 'https://via.placeholder.com/50/00ff88/000000?text=?';
    const trimmed = url.trim().toLowerCase();
    if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:') || trimmed.startsWith('vbscript:')) {
        return 'https://via.placeholder.com/50/00ff88/000000?text=?';
    }
    return url;
}

// ═══════════════════════════════════════
// TOAST NOTIFICATION SYSTEM
// ═══════════════════════════════════════
function showToast(type, title, message, duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-icon">${icons[type] || 'ℹ️'}</div>
        <div class="toast-content">
            <div class="toast-title">${escapeHtml(title)}</div>
            <div class="toast-message">${escapeHtml(message)}</div>
        </div>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ═══════════════════════════════════════
// PARTICLE BACKGROUND
// ═══════════════════════════════════════
function initParticles() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];
    const PARTICLE_COUNT = 50;

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function createParticle() {
        return {
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            size: Math.random() * 2 + 0.5,
            opacity: Math.random() * 0.5 + 0.1,
            color: Math.random() > 0.5 ? '0, 255, 136' : '0, 243, 255'
        };
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push(createParticle());
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;

            if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${p.color}, ${p.opacity})`;
            ctx.fill();
        });

        // Draw connections
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 150) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(0, 255, 136, ${0.05 * (1 - dist / 150)})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }

        requestAnimationFrame(animate);
    }
    animate();
}

// ═══════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════
const app = {
    colleges: [
        {
            id: 1, name: 'Green Valley Institute',
            logo: 'https://via.placeholder.com/120/00ff88/000000?text=GVI',
            color: '#00ff88'
        },
        {
            id: 2, name: 'Tech City College',
            logo: 'https://via.placeholder.com/120/3b82f6/ffffff?text=TCC',
            color: '#3b82f6'
        },
        {
            id: 3, name: 'Metro University',
            logo: 'https://via.placeholder.com/120/f59e0b/000000?text=MU',
            color: '#f59e0b'
        },
        {
            id: 4, name: 'North Hills Academy',
            logo: 'https://via.placeholder.com/120/ec4899/ffffff?text=NHA',
            color: '#ec4899'
        }
    ],

    data: {
        electricity: 1200,
        solar: 600,
        trees: 0,
        carbonSaved: 492,
        greenScore: 82,
        electricityHash: null,
        solarHash: null,
        collegeName: 'Green Valley Institute'
    },

    currentCollege: null,
    userAddress: null,
    peraWallet: null,
    algodClient: null,
    indexerClient: null,

    // ─── INITIALIZATION ───
    init() {
        debugLog("Initializing CampusCarbon App...");

        // Initialize Algorand clients
        try {
            this.algodClient = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', '');
            this.indexerClient = new algosdk.Indexer('', 'https://testnet-idx.algonode.cloud', '');
        } catch (e) {
            debugLog("warn", "Algorand SDK init warning:", e);
        }

        // Load saved data
        this.loadData();

        // Default college
        this.currentCollege = this.colleges[0];

        // Initialize Pera Wallet
        if (typeof window.PeraWalletConnect !== 'undefined') {
            try {
                this.peraWallet = new window.PeraWalletConnect.PeraWalletConnect();
                this.peraWallet.reconnectSession().then((accounts) => {
                    if (accounts.length) {
                        this.userAddress = accounts[0];
                        this.updateWalletUI();
                        this.loadLogo();
                    }
                    this.peraWallet.connector?.on("disconnect", () => {
                        this.userAddress = null;
                        this.resetWalletUI();
                    });
                }).catch((err) => {
                    debugLog("error", "Pera Wallet reconnect failed:", err);
                });
            } catch (error) {
                debugLog("error", "Pera Wallet Init Error:", error);
            }
        }

        // Set Date
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const dateEl = document.getElementById('current-date');
        if (dateEl) dateEl.innerText = new Date().toLocaleDateString('en-US', options);

        // Event Listeners
        document.getElementById('college-select')?.addEventListener('change', (e) => {
            this.selectCollege(parseInt(e.target.value));
        });

        document.getElementById('login-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });

        document.getElementById('energyForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmission();
        });

        // Initialize UI
        this.updateDashboardUI();
        this.showHome();

        // Start particles
        initParticles();

        debugLog("App initialized successfully ✅");
    },

    // ─── MOBILE MENU ───
    toggleMobileMenu() {
        const menu = document.getElementById('nav-menu');
        const hamburger = document.getElementById('hamburger-btn');
        if (menu && hamburger) {
            menu.classList.toggle('open');
            hamburger.classList.toggle('active');
        }
    },

    closeMobileMenu() {
        const menu = document.getElementById('nav-menu');
        const hamburger = document.getElementById('hamburger-btn');
        if (menu) menu.classList.remove('open');
        if (hamburger) hamburger.classList.remove('active');
    },

    // ─── PROFILE LOGO ───
    handleLogoUpload(input) {
        if (input.files && input.files[0]) {
            const file = input.files[0];
            const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
            if (!validTypes.includes(file.type)) {
                showToast('error', 'Invalid File', 'Please upload an image (JPG, PNG, WEBP).');
                return;
            }
            if (file.size > 2 * 1024 * 1024) {
                showToast('error', 'File Too Large', 'Max 2MB allowed.');
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const base64Image = e.target.result;
                const logoEl = document.getElementById('dash-logo');
                if (logoEl) logoEl.src = base64Image;

                const key = this.userAddress ? `collegeProfileImage_${this.userAddress}` : `collegeProfileImage_demo`;
                localStorage.setItem(key, base64Image);
                showToast('success', 'Logo Updated', 'Your campus logo has been updated.');
            };
            reader.readAsDataURL(file);
        }
    },

    loadLogo() {
        const key = this.userAddress ? `collegeProfileImage_${this.userAddress}` : `collegeProfileImage_demo`;
        const savedImage = localStorage.getItem(key);
        const logoEl = document.getElementById('dash-logo');
        if (savedImage && logoEl) {
            logoEl.src = savedImage;
        } else if (logoEl && this.currentCollege) {
            logoEl.src = this.currentCollege.logo;
        }
    },

    selectCollege(id) {
        this.currentCollege = this.colleges.find(c => c.id === id);
        if (this.currentCollege) {
            const dashName = document.getElementById('dash-college-name');
            const dashLogo = document.getElementById('dash-logo');
            if (dashName) dashName.innerText = this.currentCollege.name;
            if (dashLogo) dashLogo.src = this.currentCollege.logo;
        }
    },

    // ─── VALIDATION ───
    validateInputs(electricity, solar) {
        let isValid = true;
        this.clearErrors();

        if (isNaN(electricity) || electricity <= 0) {
            this.showError('electricity-error', 'Must be a positive number.');
            isValid = false;
        }
        if (isNaN(solar) || solar < 0) {
            this.showError('solar-error', 'Cannot be negative.');
            isValid = false;
        }
        if (electricity > 50000) {
            this.showError('electricity-error', 'Exceeds realistic campus cap (50,000 kWh).');
            isValid = false;
        }
        if (solar > electricity) {
            this.showError('solar-error', 'Solar generation cannot exceed total usage.');
            isValid = false;
        }
        return isValid;
    },

    validateFile(file, errorId) {
        if (!file) {
            this.showError(errorId, 'File is required.');
            return false;
        }
        if (file.type !== 'application/pdf') {
            this.showError(errorId, 'Only PDF files are allowed.');
            return false;
        }
        if (file.size > 5 * 1024 * 1024) {
            this.showError(errorId, 'File size must be less than 5MB.');
            return false;
        }
        return true;
    },

    async generateHash(file) {
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    showError(elementId, message) {
        const el = document.getElementById(elementId);
        if (el) {
            el.innerText = message;
            el.style.display = 'block';
        }
    },

    clearErrors() {
        const errorIds = ['electricity-error', 'solar-error', 'bill-error', 'solar-error-file', 'general-error'];
        errorIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.style.display = 'none';
                el.innerText = '';
            }
        });
    },

    // ─── SUBMISSION ───
    async handleSubmission() {
        this.clearErrors();

        const electricity = parseFloat(document.getElementById('electricity').value);
        const solar = parseFloat(document.getElementById('solar').value);
        const billFile = document.getElementById('bill-upload').files[0];
        const solarFile = document.getElementById('solar-upload').files[0];

        // Input Validation
        if (!this.validateInputs(electricity, solar)) return;

        // File Validation
        let filesValid = true;
        if (!this.validateFile(billFile, 'bill-error')) filesValid = false;
        if (!this.validateFile(solarFile, 'solar-error-file')) filesValid = false;
        if (!filesValid) return;

        // Processing UI
        const submitBtn = document.getElementById('submit-btn');
        const loading = document.getElementById('loading-indicator');
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.5';
        if (loading) loading.classList.remove('hidden');

        try {
            // Generate file hashes
            const billHash = await this.generateHash(billFile);
            const solarHash = await this.generateHash(solarFile);

            // Calculate
            const result = this.calculateCarbon(electricity, solar, 0);

            // Update state
            this.data.electricity = electricity;
            this.data.solar = solar;
            this.data.trees = 0;
            this.data.carbonSaved = Math.round(result.totalCarbonSaved);
            this.data.greenScore = Math.round(result.greenScore);
            this.data.electricityHash = billHash;
            this.data.solarHash = solarHash;
            this.data.collegeName = this.currentCollege ? this.currentCollege.name : 'Unknown';

            this.saveData();

            const payload = {
                electricity: this.data.electricity,
                solar: this.data.solar,
                totalCarbonSaved: this.data.carbonSaved,
                greenScore: this.data.greenScore,
                electricityHash: billHash,
                solarHash: solarHash,
                collegeId: this.currentCollege ? this.currentCollege.id : 1,
                collegeName: this.data.collegeName
            };

            // Submit to backend API
            try {
                const response = await fetch('/api/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const apiResult = await response.json();
                debugLog("API Response:", apiResult);
            } catch (apiErr) {
                debugLog("warn", "Backend API unavailable, continuing in demo mode:", apiErr);
            }

            // Simulate processing delay
            setTimeout(async () => {
                try {
                    this.updateDashboardUI(true);
                    this.showResultCard(billHash, solarHash);
                    this.showDashboardTab('overview');

                    // Try blockchain submission
                    if (this.userAddress && this.peraWallet && this.appId > 0) {
                        await this.submitToBlockchain(electricity, solar, payload);
                        showToast('success', 'On-Chain Verified', 'Data submitted to Algorand blockchain!');
                    } else {
                        showToast('success', 'Data Saved', 'Submitted successfully in demo mode.');
                    }
                } catch (e) {
                    debugLog("error", "Submit error:", e);
                    showToast('error', 'Submission Error', 'Blockchain submission failed. Data saved locally.');
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.style.opacity = '1';
                    if (loading) loading.classList.add('hidden');
                }
            }, 2000);

        } catch (e) {
            debugLog("error", e);
            this.showError('general-error', 'An unexpected error occurred.');
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
            if (loading) loading.classList.add('hidden');
        }
    },

    // ─── RESULT MODAL (was missing!) ───
    showResultCard(billHash, solarHash) {
        const tokens = Math.floor(this.data.carbonSaved / 100);

        const modalCarbon = document.getElementById('modal-carbon');
        const modalScore = document.getElementById('modal-score');
        const modalTokens = document.getElementById('modal-tokens');
        const modalBillHash = document.getElementById('modal-bill-hash');
        const modalSolarHash = document.getElementById('modal-solar-hash');

        if (modalCarbon) modalCarbon.innerText = this.data.carbonSaved + ' kg CO₂';
        if (modalScore) modalScore.innerText = this.data.greenScore + '%';
        if (modalTokens) modalTokens.innerText = tokens + ' CT';
        if (modalBillHash) modalBillHash.innerText = billHash ? billHash.substring(0, 32) + '...' : '—';
        if (modalSolarHash) modalSolarHash.innerText = solarHash ? solarHash.substring(0, 32) + '...' : '—';

        const modal = document.getElementById('result-modal');
        if (modal) modal.classList.remove('hidden');
    },

    closeResultModal() {
        const modal = document.getElementById('result-modal');
        if (modal) modal.classList.add('hidden');
    },

    calculateCarbon(electricity, solar, trees) {
        const carbonPerUnit = 0.82;
        const solarCarbon = solar * carbonPerUnit;
        const treeCarbon = trees * 21;
        const totalCarbonSaved = solarCarbon + treeCarbon;
        const greenScore = electricity > 0 ? (totalCarbonSaved / electricity) * 100 : 0;
        return {
            totalCarbonSaved,
            greenScore: greenScore > 100 ? 100 : greenScore
        };
    },

    saveData() {
        localStorage.setItem('campusCarbonData', JSON.stringify(this.data));
    },

    loadData() {
        const saved = localStorage.getItem('campusCarbonData');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed && typeof parsed === 'object') {
                    this.data = { ...this.data, ...parsed };
                }
            } catch (e) {
                debugLog("warn", "Could not load saved data:", e);
                localStorage.removeItem('campusCarbonData');
            }
        }
    },

    // ─── UI & NAVIGATION ───
    updateDashboardUI(animate = false) {
        const animateValue = (id, start, end, duration) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (!animate) {
                el.innerText = end;
                return;
            }
            let startTimestamp = null;
            const step = (timestamp) => {
                if (!startTimestamp) startTimestamp = timestamp;
                const progress = Math.min((timestamp - startTimestamp) / duration, 1);
                el.innerText = Math.floor(progress * (end - start) + start);
                if (progress < 1) window.requestAnimationFrame(step);
            };
            window.requestAnimationFrame(step);
        };

        animateValue("electricityValue", 0, this.data.electricity, 1500);
        animateValue("solarValue", 0, this.data.solar, 1500);

        const cVal = document.getElementById("carbonValue");
        if (cVal) cVal.innerText = this.data.carbonSaved;

        const scoreEl = document.getElementById("scoreValue");
        const statusEl = document.getElementById("score-status-text");

        if (scoreEl) scoreEl.innerText = `${this.data.greenScore}%`;

        // Circular Progress
        const circle = document.getElementById("score-ring-circle");
        if (circle) {
            const radius = circle.r.baseVal.value;
            const circumference = radius * 2 * Math.PI;
            const offset = circumference - (this.data.greenScore / 100) * circumference;
            circle.style.strokeDashoffset = offset;

            if (this.data.greenScore > 75) {
                circle.style.stroke = "#00ff88";
                if (statusEl) { statusEl.innerText = "Excellent Rating ⭐"; statusEl.style.color = "#00ff88"; }
            } else if (this.data.greenScore >= 40) {
                circle.style.stroke = "#f59e0b";
                if (statusEl) { statusEl.innerText = "Moderate Rating ⚠️"; statusEl.style.color = "#f59e0b"; }
            } else {
                circle.style.stroke = "#ef4444";
                if (statusEl) { statusEl.innerText = "Needs Improvement 🛑"; statusEl.style.color = "#ef4444"; }
            }
        }

        // ★ UPDATE SUMMARY BAR (was missing!)
        const sumEnergy = document.getElementById('sum-energy');
        const sumSolarRatio = document.getElementById('sum-solar-ratio');
        const sumImpact = document.getElementById('sum-impact');

        if (sumEnergy) sumEnergy.innerText = this.data.electricity + ' kWh';

        if (sumSolarRatio) {
            const ratio = this.data.electricity > 0
                ? Math.round((this.data.solar / this.data.electricity) * 100)
                : 0;
            sumSolarRatio.innerText = ratio + '%';
        }

        if (sumImpact) {
            if (this.data.greenScore > 75) {
                sumImpact.innerText = 'Excellent';
                sumImpact.style.color = '#00ff88';
            } else if (this.data.greenScore >= 40) {
                sumImpact.innerText = 'Moderate';
                sumImpact.style.color = '#f59e0b';
            } else {
                sumImpact.innerText = 'Low';
                sumImpact.style.color = '#ef4444';
            }
        }
    },

    updatePreview() {
        const elec = parseFloat(document.getElementById('electricity').value) || 0;
        const solar = parseFloat(document.getElementById('solar').value) || 0;
        const result = this.calculateCarbon(elec, solar, 0);
        const tokens = Math.floor(result.totalCarbonSaved / 100);

        const pc = document.getElementById('prev-carbon');
        const ps = document.getElementById('prev-score');
        const pt = document.getElementById('prev-tokens');

        if (pc) pc.innerText = Math.round(result.totalCarbonSaved) + ' kg';
        if (ps) ps.innerText = Math.round(result.greenScore) + '%';
        if (pt) pt.innerText = tokens + ' CT';
    },

    // Navigation
    hideAllSections() {
        ['home-page', 'login-page', 'dashboard-page', 'leaderboard-page'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
    },

    showHome() {
        this.closeMobileMenu();
        this.hideAllSections();
        document.getElementById('home-page').classList.remove('hidden');
        document.querySelector('.navbar').classList.remove('hidden');
        document.querySelector('.footer').classList.remove('hidden');
    },

    showLogin() {
        this.closeMobileMenu();
        this.hideAllSections();
        document.getElementById('login-page').classList.remove('hidden');
        document.querySelector('.navbar').classList.remove('hidden');
        document.querySelector('.footer').classList.remove('hidden');
    },

    showDashboard() {
        this.hideAllSections();
        document.getElementById('dashboard-page').classList.remove('hidden');
        document.querySelector('.navbar').classList.add('hidden');
        document.querySelector('.footer').classList.add('hidden');
        this.showDashboardTab('overview');
        this.loadLogo();
    },

    showDashboardTab(tabName) {
        const t1 = document.getElementById('tab-overview');
        const t2 = document.getElementById('tab-submit');
        if (t1) t1.classList.add('hidden');
        if (t2) t2.classList.add('hidden');

        const target = document.getElementById('tab-' + tabName);
        if (target) target.classList.remove('hidden');

        // Update sidebar active state
        document.querySelectorAll('.sidebar-link').forEach(l => {
            l.classList.remove('active');
        });
        const activeNav = document.getElementById('nav-' + tabName);
        if (activeNav) activeNav.classList.add('active');
    },

    showLeaderboard(isPublic = true) {
        this.closeMobileMenu();
        this.hideAllSections();
        document.getElementById('leaderboard-page').classList.remove('hidden');
        if (isPublic) {
            document.querySelector('.navbar').classList.remove('hidden');
        } else {
            document.querySelector('.navbar').classList.add('hidden');
        }
        document.querySelector('.footer').classList.remove('hidden');
        this.fetchLeaderboard();
    },

    renderLeaderboardData(data) {
        const list = document.getElementById('leaderboard-list');
        if (!list) return;

        if (data.length === 0) {
            list.innerHTML = '<div style="text-align:center; padding: 2rem; color: var(--text-secondary);">No data yet. Be the first to submit!</div>';
            return;
        }

        const collegeLogos = {};
        this.colleges.forEach(c => { collegeLogos[c.name] = c.logo; });

        let html = '';
        data.forEach((c, i) => {
            let badgeStyle = 'background: rgba(255,255,255,0.1); color: #fff;';
            let cardExtra = '';

            if (i === 0) {
                badgeStyle = 'background: linear-gradient(135deg, #ffd700, #b8860b); color: #000; box-shadow: 0 0 10px rgba(255,215,0,0.4);';
                cardExtra = 'border-color: rgba(255,215,0,0.3); transform: scale(1.02);';
            } else if (i === 1) {
                badgeStyle = 'background: linear-gradient(135deg, #e0e0e0, #a0a0a0); color: #000;';
            } else if (i === 2) {
                badgeStyle = 'background: linear-gradient(135deg, #cd7f32, #8b4513); color: #000;';
            }

            const name = c.collegeName || c.name || 'Unknown Campus';
            const logo = collegeLogos[name] || c.logo || 'https://via.placeholder.com/50/00ff88/000000?text=C';
            const score = c.greenScore || c.score || 0;

            html += `
            <div class="glass-panel rank-card" style="${cardExtra}">
               <div class="rank-badge" style="${badgeStyle}">${i + 1}</div>
               <img src="${safeLogoUrl(logo)}" alt="${escapeHtml(name)}">
               <div class="rank-info">
                   <div class="rank-name">${escapeHtml(name)}</div>
                   <div style="font-size: 0.8rem; color: var(--text-secondary);">Verified Campus</div>
               </div>
               <div class="rank-score">${escapeHtml(String(score))}%</div>
            </div>
            `;
        });
        list.innerHTML = html;
    },

    // ─── BLOCKCHAIN & LEADERBOARD ───
    get appId() {
        const cfg = (typeof window !== 'undefined' && window.CAMPUS_CARBON_CONFIG) ? window.CAMPUS_CARBON_CONFIG : {};
        return cfg.APP_ID || 0;
    },

    async fetchLeaderboard() {
        const list = document.getElementById('leaderboard-list');
        if (!list) return;

        // Try backend API first
        try {
            const response = await fetch('/api/leaderboard');
            const data = await response.json();
            if (data.success && data.leaderboard.length > 0) {
                this.renderLeaderboardData(data.leaderboard);
                return;
            }
        } catch (e) {
            debugLog("warn", "Backend API unavailable for leaderboard:", e);
        }

        // Fallback: try on-chain data
        if (this.appId === 0 || !this.indexerClient) {
            // Use local fallback data
            const fallback = this.colleges.map(c => {
                if (this.currentCollege && c.name === this.currentCollege.name && this.data.greenScore > 0) {
                    return { collegeName: c.name, greenScore: this.data.greenScore, logo: c.logo };
                }
                const scores = { 1: 82, 2: 65, 3: 45, 4: 91 };
                return { collegeName: c.name, greenScore: scores[c.id] || 50, logo: c.logo };
            });
            fallback.sort((a, b) => b.greenScore - a.greenScore);
            this.renderLeaderboardData(fallback);
            return;
        }

        try {
            const accountsResponse = await this.indexerClient.searchAccounts().applicationID(this.appId).do();
            const accounts = accountsResponse['accounts'] || [];

            let leaderboard = accounts.map(acc => {
                const localState = acc['apps-local-state'].find(a => a.id === this.appId);
                if (!localState || !localState['key-value']) return null;

                const state = {};
                localState['key-value'].forEach(kv => {
                    const key = atob(kv.key);
                    state[key] = kv.value.uint;
                });

                return {
                    collegeName: `Campus ${acc.address.slice(0, 4)}`,
                    greenScore: state['green_score'] || 0,
                    logo: 'https://via.placeholder.com/50/00ff88/000000?text=C'
                };
            }).filter(x => x !== null);

            leaderboard.sort((a, b) => b.greenScore - a.greenScore);
            this.renderLeaderboardData(leaderboard);

        } catch (e) {
            debugLog("error", "Leaderboard Fetch Error:", e);
            list.innerHTML = '<div style="text-align:center; padding: 2rem; color: var(--danger);">Failed to load data. Using local fallback.</div>';

            // Fallback
            setTimeout(() => {
                const fallback = this.colleges.map(c => {
                    const scores = { 1: 82, 2: 65, 3: 45, 4: 91 };
                    return { collegeName: c.name, greenScore: scores[c.id], logo: c.logo };
                }).sort((a, b) => b.greenScore - a.greenScore);
                this.renderLeaderboardData(fallback);
            }, 1000);
        }
    },

    async checkOptIn() {
        if (!this.userAddress || !this.appId || !this.algodClient) return false;
        try {
            const accountInfo = await this.algodClient.accountInformation(this.userAddress).do();
            const apps = accountInfo['apps-local-state'] || [];
            return apps.some(a => a.id === this.appId);
        } catch (e) {
            debugLog("error", "Error checking opt-in:", e);
            return false;
        }
    },

    async optInToApp() {
        if (!this.peraWallet || !this.userAddress || !this.algodClient) return false;
        try {
            const suggestedParams = await this.algodClient.getTransactionParams().do();
            const txn = algosdk.makeApplicationOptInTxnFromObject({
                from: this.userAddress,
                appIndex: this.appId,
                suggestedParams
            });

            const singleTxnGroups = [{ txn: txn, signers: [this.userAddress] }];
            const signedTxn = await this.peraWallet.signTransaction([singleTxnGroups]);
            const { txId } = await this.algodClient.sendRawTransaction(signedTxn).do();
            await algosdk.waitForConfirmation(this.algodClient, txId, 4);
            debugLog("Opt-In Successful:", txId);
            showToast('success', 'Opted In', 'Successfully opted into the smart contract.');
            return true;
        } catch (e) {
            debugLog("error", "Opt-In Failed:", e);
            showToast('error', 'Opt-In Failed', 'Could not opt into smart contract.');
            return false;
        }
    },

    async submitToBlockchain(electricity, solar, payload) {
        if (!this.userAddress || !this.peraWallet || !this.algodClient) {
            debugLog("warn", "Wallet not connected.");
            return;
        }

        if (this.appId === 0) {
            showToast('warning', 'No Contract', 'App ID not configured. Running in demo mode.');
            return;
        }

        try {
            // Check Opt-In
            const isOptedIn = await this.checkOptIn();
            if (!isOptedIn) {
                const opted = await this.optInToApp();
                if (!opted) return;
            }

            // Build ABI-encoded app args
            // Method selector for submit_data(uint64,uint64,uint64,uint64)
            const methodSignature = 'submit_data(uint64,uint64,uint64,uint64)void';
            const hash = new Uint8Array(await crypto.subtle.digest('SHA-512/256',
                new TextEncoder().encode(methodSignature)));
            const selector = hash.slice(0, 4);

            const args = [
                selector,
                algosdk.encodeUint64(Number(electricity)),
                algosdk.encodeUint64(Number(solar)),
                algosdk.encodeUint64(Number(payload.totalCarbonSaved || 0)),
                algosdk.encodeUint64(Number(payload.greenScore || 0))
            ];

            const suggestedParams = await this.algodClient.getTransactionParams().do();
            const appCallTxn = algosdk.makeApplicationCallTxnFromObject({
                appIndex: this.appId,
                from: this.userAddress,
                appArgs: args,
                suggestedParams
            });

            const signedTxn = await this.peraWallet.signTransaction([[{ txn: appCallTxn, signers: [this.userAddress] }]]);
            const { txId } = await this.algodClient.sendRawTransaction(signedTxn).do();
            await algosdk.waitForConfirmation(this.algodClient, txId, 4);
            debugLog("Blockchain Submit Success:", txId);
        } catch (error) {
            debugLog("error", "Blockchain Submit Error:", error);
            throw error; // Re-throw to be caught by caller
        }
    },

    // ─── AUTH ───
    login() {
        const btn = document.getElementById('login-btn');
        const old = btn ? btn.innerText : 'Login';
        if (btn) btn.innerText = 'Verifying...';

        const collegeSelect = document.getElementById('college-select');
        if (collegeSelect) {
            this.selectCollege(parseInt(collegeSelect.value));
        }

        // Try backend auth
        const email = document.getElementById('login-email')?.value || 'demo@campus.io';
        const collegeId = collegeSelect?.value || '1';

        fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, collegeId })
        }).then(res => res.json()).catch(() => ({ success: true })).then(() => {
            setTimeout(() => {
                if (btn) btn.innerText = old;
                this.showDashboard();
                showToast('success', 'Welcome!', `Logged in as ${this.currentCollege ? this.currentCollege.name : 'Campus'}`);
            }, 800);
        });
    },

    logout() {
        this.currentCollege = this.colleges[0];
        this.showHome();
        showToast('info', 'Logged Out', 'You have been logged out.');
    },

    // ─── WALLET ───
    async connectWallet() {
        if (!this.peraWallet) {
            showToast('error', 'Wallet Error', 'Pera Wallet SDK not loaded. Please refresh the page.');
            return;
        }
        if (this.userAddress) {
            this.peraWallet.disconnect();
            this.userAddress = null;
            this.resetWalletUI();
            showToast('info', 'Disconnected', 'Wallet disconnected successfully.');
        } else {
            try {
                const accts = await this.peraWallet.connect();
                this.userAddress = accts[0];
                this.updateWalletUI();
                this.loadLogo();
                showToast('success', 'Connected!', `Wallet ${this.userAddress.slice(0, 6)}...${this.userAddress.slice(-4)} connected.`);
            } catch (e) {
                debugLog("error", "Wallet connect failed:", e);
                showToast('error', 'Connection Failed', 'Could not connect to Pera Wallet. Please try again.');
            }
        }
    },

    updateWalletUI() {
        const btn = document.getElementById("connectWalletBtn");
        const btnText = document.getElementById("walletBtnText");

        if (this.userAddress && btn) {
            btn.classList.add('connected');
            if (btnText) {
                const shortAddr = this.userAddress.slice(0, 4) + '...' + this.userAddress.slice(-4);
                btnText.innerText = shortAddr;
            }
        }
    },

    resetWalletUI() {
        const btn = document.getElementById("connectWalletBtn");
        const btnText = document.getElementById("walletBtnText");

        if (btn) btn.classList.remove('connected');
        if (btnText) btnText.innerText = "Connect Wallet";
    },
};

// ─── BOOTSTRAP ───
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});