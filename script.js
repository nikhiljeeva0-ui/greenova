// ═══════════════════════════════════════
// Greenova — Pure Web3 Frontend
// Architecture: Frontend → Pera Wallet → Smart Contract → Algorand Blockchain
// NO backend server. Everything on-chain.
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

function escapeHtml(str) {
    if (str == null || typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Generate inline SVG logo (no external URLs needed)
function makeSvgLogo(text, bg, fg) {
    bg = bg || '062'; fg = fg || '00ff88';
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Crect fill='%23" + bg + "' width='120' height='120' rx='60'/%3E%3Ctext x='50%25' y='55%25' text-anchor='middle' dy='.35em' fill='%23" + fg + "' font-family='Arial' font-size='28' font-weight='bold'%3E" + encodeURIComponent(text) + "%3C/text%3E%3C/svg%3E";
}

function safeLogoUrl(url) {
    if (!url || typeof url !== 'string') return makeSvgLogo('?');
    const trimmed = url.trim().toLowerCase();
    if (trimmed.startsWith('javascript:') || trimmed.startsWith('vbscript:')) {
        return makeSvgLogo('?');
    }
    return url;
}

function base64ToUint8Array(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function withTimeout(promise, ms, label) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error((label || 'Operation') + ` timed out after ${ms}ms`));
        }, ms);

        Promise.resolve(promise)
            .then((value) => {
                clearTimeout(timeoutId);
                resolve(value);
            })
            .catch((error) => {
                clearTimeout(timeoutId);
                reject(error);
            });
    });
}

// ═══════════════════════════════════════
// TOAST NOTIFICATIONS
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
    const COUNT = 50;

    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < COUNT; i++) {
        particles.push({
            x: Math.random() * canvas.width, y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
            size: Math.random() * 2 + 0.5, opacity: Math.random() * 0.5 + 0.1,
            color: Math.random() > 0.5 ? '0, 255, 136' : '0, 243, 255'
        });
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${p.color}, ${p.opacity})`; ctx.fill();
        });
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 150) {
                    ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(0, 255, 136, ${0.05 * (1 - dist / 150)})`;
                    ctx.lineWidth = 0.5; ctx.stroke();
                }
            }
        }
        requestAnimationFrame(animate);
    }
    animate();
}

// ═══════════════════════════════════════
// ABI METHOD SELECTOR — using algosdk.ABIMethod
// (Correctly computes SHA-512/256 via algosdk's built-in impl)
// ═══════════════════════════════════════
function computeMethodSelector(methodSignature) {
    // Parse method signature: "name(type1,type2,...)returnType"
    const parenStart = methodSignature.indexOf('(');
    const parenEnd = methodSignature.lastIndexOf(')');
    const name = methodSignature.substring(0, parenStart);
    const argsStr = methodSignature.substring(parenStart + 1, parenEnd);
    const returnType = methodSignature.substring(parenEnd + 1) || 'void';

    const argTypes = argsStr ? argsStr.split(',') : [];
    const args = argTypes.map((t, i) => ({ type: t.trim(), name: `arg${i}` }));

    const method = new algosdk.ABIMethod({
        name: name,
        args: args,
        returns: { type: returnType }
    });

    const selector = method.getSelector();
    debugLog('ABI Selector for', methodSignature, '→', Array.from(selector).map(b => b.toString(16).padStart(2, '0')).join(''));
    return selector;
}


// ═══════════════════════════════════════
// MAIN APPLICATION
// ═══════════════════════════════════════
const app = {
    // No hardcoded colleges — user enters their own college name at login

    // Initial data: all zeros until real data is submitted
    demoData: {
        electricity: 0, solar: 0, carbonSaved: 0, greenScore: 0,
        tokensEarned: 0, hasBadge: 0
    },

    data: {
        electricity: 0,
        solar: 0,
        carbonSaved: 0,
        greenScore: 0,
        tokensEarned: 0,
        hasBadge: 0,
        electricityHash: null,
        solarHash: null,
        collegeName: ''
    },

    isOnChainData: false,  // true once real blockchain data is loaded

    currentCollege: null,
    userAddress: null,
    peraWallet: null,
    peraWalletCtor: null,
    algodClient: null,
    indexerClient: null,

    // ═══════════════════════════════════════
    // APP ID — from config.js (set after deploy)
    // ═══════════════════════════════════════
    get appId() {
        const cfg = (typeof window !== 'undefined' && window.CAMPUS_CARBON_CONFIG) ? window.CAMPUS_CARBON_CONFIG : {};
        return cfg.APP_ID || 0;
    },

    get algodUrl() {
        const cfg = (typeof window !== 'undefined' && window.CAMPUS_CARBON_CONFIG) ? window.CAMPUS_CARBON_CONFIG : {};
        return cfg.ALGOD_URL || 'https://testnet-api.algonode.cloud';
    },

    get algodToken() {
        const cfg = (typeof window !== 'undefined' && window.CAMPUS_CARBON_CONFIG) ? window.CAMPUS_CARBON_CONFIG : {};
        return cfg.ALGOD_TOKEN || '';
    },

    get indexerUrl() {
        const cfg = (typeof window !== 'undefined' && window.CAMPUS_CARBON_CONFIG) ? window.CAMPUS_CARBON_CONFIG : {};
        return cfg.INDEXER_URL || 'https://testnet-idx.algonode.cloud';
    },

    get walletChainId() {
        const url = (this.algodUrl || '').toLowerCase();
        // Algorand WalletConnect chain IDs: mainnet=416001, testnet=416002
        return url.includes('testnet') ? 416002 : 416001;
    },

    createPeraWalletInstance() {
        if (!this.peraWalletCtor) return null;
        try {
            // @perawallet/connect@1.3.x accepts { shouldShowSignTxnToast: true } or empty
            return new this.peraWalletCtor({ shouldShowSignTxnToast: true });
        } catch (e) {
            try {
                return new this.peraWalletCtor();
            } catch (_) {
                return null;
            }
        }
    },

    // Parse URL into {baseUrl, port} for algosdk (which requires port as separate param)
    parseUrl(urlString) {
        try {
            const u = new URL(urlString);
            const port = u.port ? parseInt(u.port) : (u.protocol === 'https:' ? 443 : 80);
            const baseUrl = u.protocol + '//' + u.hostname;
            return { baseUrl, port };
        } catch (e) {
            return { baseUrl: urlString, port: '' };
        }
    },

    // ═══════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════
    init() {
        debugLog("⚡ Initializing Greenova (Pure Web3 Mode)...");

        // Initialize Algorand clients — port MUST be separate argument for algosdk
        try {
            const algod = this.parseUrl(this.algodUrl);
            const indexer = this.parseUrl(this.indexerUrl);
            this.algodClient = new algosdk.Algodv2(this.algodToken, algod.baseUrl, algod.port);
            this.indexerClient = new algosdk.Indexer('', indexer.baseUrl, indexer.port);
            debugLog('Algorand clients initialized:', algod.baseUrl + ':' + algod.port);
        } catch (e) {
            debugLog("error", "Algorand SDK init error:", e);
        }

        // Default college — will be set on login
        this.currentCollege = null;

        // Initialize Pera Wallet — try multiple global variants
        try {
            let PeraWalletClass = null;

            // @perawallet/connect UMD exports to window.PeraWalletConnect namespace
            if (window.PeraWalletConnect && typeof window.PeraWalletConnect.PeraWalletConnect === 'function') {
                PeraWalletClass = window.PeraWalletConnect.PeraWalletConnect;
                debugLog('Pera SDK found via: PeraWalletConnect.PeraWalletConnect');
            } else if (typeof window.PeraWalletConnect === 'function') {
                PeraWalletClass = window.PeraWalletConnect;
                debugLog('Pera SDK found via: PeraWalletConnect (direct)');
            } else if (window.PeraWalletConnect && typeof window.PeraWalletConnect.default === 'function') {
                PeraWalletClass = window.PeraWalletConnect.default;
                debugLog('Pera SDK found via: PeraWalletConnect.default');
            }

            if (PeraWalletClass) {
                this.peraWalletCtor = PeraWalletClass;
                this.peraWallet = this.createPeraWalletInstance();
                debugLog('✅ Pera Wallet initialized successfully');

                this.peraWallet.reconnectSession().then((accounts) => {
                    if (accounts.length) {
                        this.userAddress = accounts[0];
                        debugLog('Wallet reconnected:', this.userAddress);
                        this.updateWalletUI();
                        this.loadLogo();
                        this.loadOnChainData();
                    }
                }).catch((err) => {
                    debugLog("warn", "Pera reconnect:", err.message || err);
                });
            } else {
                debugLog("error", "❌ Pera Wallet SDK not found! window.PeraWalletConnect =", typeof window.PeraWalletConnect, window.PeraWalletConnect);
                if (window.PeraWalletConnect) {
                    console.log('DEBUG — Available keys:', Object.keys(window.PeraWalletConnect));
                }
            }
        } catch (error) {
            debugLog("error", "Pera Wallet Init Error:", error);
        }

        // Set Date
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const dateEl = document.getElementById('current-date');
        if (dateEl) dateEl.innerText = new Date().toLocaleDateString('en-US', options);

        // Event Listeners

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
        initParticles();

        debugLog("App initialized ✅ | App ID:", this.appId || "NOT SET");
    },

    // ═══════════════════════════════════════
    // ON-CHAIN DATA LOADING
    // Read wallet's local state from blockchain
    // ═══════════════════════════════════════
    async loadOnChainData() {
        if (!this.userAddress || !this.appId || !this.algodClient) {
            debugLog("warn", "Cannot load on-chain data: wallet or appId not set");
            return;
        }

        try {
            debugLog("Loading on-chain data for:", this.userAddress.slice(0, 8) + "...");
            const accountInfo = await this.algodClient.accountInformation(this.userAddress).do();
            const appsLocal = accountInfo['apps-local-state'] || [];
            const appState = appsLocal.find(a => a.id === this.appId);

            if (appState && appState['key-value']) {
                const state = {};
                appState['key-value'].forEach(kv => {
                    const key = atob(kv.key);
                    state[key] = kv.value.uint !== undefined ? kv.value.uint : 0;
                });

                debugLog("On-chain state:", state);

                // Populate app data from blockchain
                this.data.electricity = state['electricity'] || 0;
                this.data.solar = state['solar'] || 0;
                this.data.carbonSaved = state['carbon_saved'] || 0;
                this.data.greenScore = state['green_score'] || 0;
                this.data.tokensEarned = state['tokens_earned'] || 0;
                this.data.hasBadge = state['has_badge'] || 0;

                this.updateDashboardUI(true);
                this.isOnChainData = true;
                showToast('success', 'On-Chain Data Loaded', `Green Score: ${this.data.greenScore}% | Tokens: ${this.data.tokensEarned} CT`);
            } else {
                debugLog("No local state found — wallet not opted in or no data yet.");
            }
        } catch (e) {
            debugLog("error", "Failed to load on-chain data:", e);
        }
    },

    // ═══════════════════════════════════════
    // MOBILE MENU
    // ═══════════════════════════════════════
    toggleMobileMenu() {
        const menu = document.getElementById('nav-menu');
        const hamburger = document.getElementById('hamburger-btn');
        if (menu && hamburger) { menu.classList.toggle('open'); hamburger.classList.toggle('active'); }
    },
    closeMobileMenu() {
        const menu = document.getElementById('nav-menu');
        const hamburger = document.getElementById('hamburger-btn');
        if (menu) menu.classList.remove('open');
        if (hamburger) hamburger.classList.remove('active');
    },

    // ═══════════════════════════════════════
    // PROFILE LOGO
    // ═══════════════════════════════════════
    handleLogoUpload(input) {
        if (input.files && input.files[0]) {
            const file = input.files[0];
            const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
            if (!validTypes.includes(file.type)) { showToast('error', 'Invalid File', 'Upload JPG, PNG, or WEBP.'); return; }
            if (file.size > 2 * 1024 * 1024) { showToast('error', 'Too Large', 'Max 2MB.'); return; }
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = e.target.result;
                const el = document.getElementById('dash-logo');
                if (el) el.src = img;
                const key = this.userAddress ? `logo_${this.userAddress}` : 'logo_demo';
                localStorage.setItem(key, img);
            };
            reader.readAsDataURL(file);
        }
    },
    loadLogo() {
        const key = this.userAddress ? `logo_${this.userAddress}` : 'logo_demo';
        const saved = localStorage.getItem(key);
        const el = document.getElementById('dash-logo');
        if (saved && el) el.src = saved;
        else if (el && this.currentCollege) el.src = this.currentCollege.logo;
    },
    setCollegeName(name) {
        const abbrev = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 4) || '?';
        this.currentCollege = { name: name, logo: makeSvgLogo(abbrev, '062', '00ff88'), color: '#00ff88' };
        this.data.collegeName = name;
        const n = document.getElementById('dash-college-name');
        const l = document.getElementById('dash-logo');
        if (n) n.innerText = name;
        if (l) l.src = this.currentCollege.logo;
    },

    // ═══════════════════════════════════════
    // VALIDATION
    // ═══════════════════════════════════════
    validateInputs(electricity, solar) {
        let ok = true;
        this.clearErrors();
        if (isNaN(electricity) || electricity <= 0) { this.showError('electricity-error', 'Must be a positive number.'); ok = false; }
        if (isNaN(solar) || solar < 0) { this.showError('solar-error', 'Cannot be negative.'); ok = false; }
        if (electricity > 50000) { this.showError('electricity-error', 'Exceeds cap (50,000 kWh).'); ok = false; }
        if (solar > electricity) { this.showError('solar-error', 'Solar cannot exceed electricity.'); ok = false; }
        return ok;
    },
    validateFile(file, errorId) {
        if (!file) { this.showError(errorId, 'File is required.'); return false; }
        const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
        if (!allowed.includes(file.type)) { this.showError(errorId, 'Only PDF, PNG, or JPG allowed.'); return false; }
        if (file.size > 5 * 1024 * 1024) { this.showError(errorId, 'Max 5MB.'); return false; }
        return true;
    },
    async generateHash(file) {
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const arr = Array.from(new Uint8Array(hashBuffer));
        return arr.map(b => b.toString(16).padStart(2, '0')).join('');
    },
    // Convert first 8 bytes of hex hash to uint64 for on-chain storage
    // Must stay within Number.MAX_SAFE_INTEGER (2^53 - 1)
    hashToUint64(hexHash) {
        // Use first 6 bytes (12 hex chars) to stay within safe integer range
        const first12Chars = hexHash.substring(0, 12);
        return parseInt(first12Chars, 16);
    },
    showError(id, msg) { const el = document.getElementById(id); if (el) { el.innerText = msg; el.style.display = 'block'; } },
    clearErrors() {
        ['electricity-error', 'solar-error', 'bill-error', 'solar-error-file', 'general-error'].forEach(id => {
            const el = document.getElementById(id); if (el) { el.style.display = 'none'; el.innerText = ''; }
        });
    },

    ensureAlgoSdkReady() {
        if (typeof algosdk === 'undefined') {
            throw new Error('algosdk is not loaded. Check the script import order/CDN availability.');
        }
    },

    encodeUnsignedTxn(txn) {
        this.ensureAlgoSdkReady();
        if (typeof algosdk.encodeUnsignedTransaction === 'function') {
            return algosdk.encodeUnsignedTransaction(txn);
        }
        if (txn && typeof txn.toByte === 'function') {
            return txn.toByte();
        }
        throw new Error('Unable to encode unsigned transaction with this algosdk version.');
    },

    normalizeSignedTxnResponse(signedTxnArr) {
        const first = Array.isArray(signedTxnArr) ? signedTxnArr[0] : signedTxnArr;
        const entry = Array.isArray(first) ? first[0] : first;

        if (entry instanceof Uint8Array) return entry;
        if (entry && entry.blob instanceof Uint8Array) return entry.blob;
        if (entry && typeof entry.blob === 'string') return base64ToUint8Array(entry.blob);
        if (typeof entry === 'string') return base64ToUint8Array(entry);

        throw new Error('Unexpected wallet signature response format.');
    },

    async signTxnWithPera(txn) {
        if (!this.peraWallet) {
            throw new Error('Pera wallet is not initialized.');
        }
        if (!this.userAddress) {
            throw new Error('Wallet address missing. Connect wallet first.');
        }
        if (!txn) {
            throw new Error('Invalid Algorand transaction object for wallet signing.');
        }

        // @perawallet/connect@1.3.x signTransaction expects an array of
        // SignerTransaction objects: [{ txn: Transaction }]
        // The SDK handles encoding internally when given a Transaction object.
        try {
            const txnsToSign = [{ txn: txn }];
            const signedTxnArr = await withTimeout(
                this.peraWallet.signTransaction([txnsToSign]),
                120000,
                'Wallet signing'
            );
            return this.normalizeSignedTxnResponse(signedTxnArr);
        } catch (err) {
            const msg = err && err.message ? err.message : String(err);
            // If the SDK can't encode, try passing encoded bytes
            if (msg.includes('get_obj_for_encoding') || msg.includes('encodeUnsignedTransaction')) {
                debugLog('warn', 'Retrying sign with pre-encoded txn...');
                try {
                    const encodedTxn = this.encodeUnsignedTxn(txn);
                    const txnsToSign = [{ txn: encodedTxn }];
                    const signedTxnArr = await withTimeout(
                        this.peraWallet.signTransaction([txnsToSign]),
                        120000,
                        'Wallet signing (encoded)'
                    );
                    return this.normalizeSignedTxnResponse(signedTxnArr);
                } catch (retryErr) {
                    throw new Error('Wallet signing failed: ' + (retryErr.message || String(retryErr)));
                }
            }
            throw err;
        }
    },

    // ═══════════════════════════════════════
    // SUBMISSION — DIRECTLY TO BLOCKCHAIN
    // Frontend → Pera Wallet → Smart Contract
    // ═══════════════════════════════════════
    async handleSubmission() {
        this.clearErrors();

        // 0. Check wallet connection
        if (!this.userAddress || !this.peraWallet) {
            showToast('warning', 'Wallet Required', 'Connect your Pera Wallet first to submit data on-chain.');
            return;
        }
        try {
            this.ensureAlgoSdkReady();
        } catch (e) {
            showToast('error', 'SDK Missing', e.message || String(e));
            return;
        }
        if (!this.appId) {
            showToast('error', 'No Contract', 'Smart contract not deployed. Set APP_ID in config.js after deploying.');
            return;
        }

        const electricity = parseFloat(document.getElementById('electricity').value);
        const solar = parseFloat(document.getElementById('solar').value);
        const billFile = document.getElementById('bill-upload').files[0];
        const solarFile = document.getElementById('solar-upload').files[0];

        // 1. Validate inputs
        if (!this.validateInputs(electricity, solar)) return;

        // 2. Validate files
        let filesOk = true;
        if (!this.validateFile(billFile, 'bill-error')) filesOk = false;
        if (!this.validateFile(solarFile, 'solar-error-file')) filesOk = false;
        if (!filesOk) return;

        // 3. Show loading
        const submitBtn = document.getElementById('submit-btn');
        const loading = document.getElementById('loading-indicator');
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.5';
        if (loading) loading.classList.remove('hidden');
        showToast('info', 'Processing...', 'Hashing files and preparing blockchain transaction.');

        try {
            // 4. Generate SHA-256 hashes of uploaded PDFs
            const billHash = await this.generateHash(billFile);
            const solarHashHex = await this.generateHash(solarFile);
            debugLog("Bill Hash:", billHash);
            debugLog("Solar Hash:", solarHashHex);

            // 5. Calculate carbon data
            const result = this.calculateCarbon(electricity, solar);
            const carbonSaved = Math.round(result.totalCarbonSaved);
            const greenScore = Math.round(result.greenScore);

            // Convert hashes to uint64 for on-chain storage
            const billHashUint = this.hashToUint64(billHash);
            const solarHashUint = this.hashToUint64(solarHashHex);

            debugLog("Submitting to blockchain:", {
                electricity, solar, carbonSaved, greenScore,
                billHashUint: billHashUint.toString(),
                solarHashUint: solarHashUint.toString()
            });

            // 6. Check opt-in status
            const isOptedIn = await this.checkOptIn();
            if (!isOptedIn) {
                showToast('info', 'Opt-In Required', 'You need to opt-in to the smart contract first. Signing opt-in transaction...');
                const opted = await withTimeout(this.optInToApp(), 180000, 'Opt-in flow');
                if (!opted) {
                    submitBtn.disabled = false;
                    submitBtn.style.opacity = '1';
                    if (loading) loading.classList.add('hidden');
                    return;
                }
            }

            // 7. Submit data to smart contract via Pera Wallet
            showToast('info', 'Sign Transaction', 'Please sign the transaction in your Pera Wallet.');

            // Compute ABI method selector for submit_data(uint64,uint64,uint64,uint64,uint64,uint64)void
            const selector = computeMethodSelector('submit_data(uint64,uint64,uint64,uint64,uint64,uint64)void');

            const appArgs = [
                selector,
                algosdk.encodeUint64(Math.floor(electricity)),
                algosdk.encodeUint64(Math.floor(solar)),
                algosdk.encodeUint64(Math.floor(carbonSaved)),
                algosdk.encodeUint64(Math.floor(greenScore)),
                algosdk.encodeUint64(Math.floor(billHashUint)),
                algosdk.encodeUint64(Math.floor(solarHashUint))
            ];

            const suggestedParams = await this.algodClient.getTransactionParams().do();
            const appCallTxn = algosdk.makeApplicationNoOpTxnFromObject({
                appIndex: this.appId,
                from: this.userAddress,
                appArgs: appArgs,
                suggestedParams
            });

            // Sign via wallet with robust handling across SDK/wallet versions
            const signedBlob = await this.signTxnWithPera(appCallTxn);
            const sendResult = await withTimeout(
                this.algodClient.sendRawTransaction(signedBlob).do(),
                45000,
                'Transaction broadcast'
            );
            const txId = sendResult.txId || sendResult.txid || sendResult.txID || appCallTxn.txID();
            debugLog("Transaction sent:", txId);
            showToast('info', 'Transaction Sent', `TX ID: ${txId.substring(0, 12)}... Waiting for confirmation...`);

            // Wait for confirmation
            const confirmed = await withTimeout(
                algosdk.waitForConfirmation(this.algodClient, txId, 8),
                90000,
                'Transaction confirmation'
            );
            debugLog("Transaction confirmed:", confirmed);

            // 8. Update local state from blockchain
            this.data.electricity = electricity;
            this.data.solar = solar;
            this.data.carbonSaved = carbonSaved;
            this.data.greenScore = greenScore;
            this.data.electricityHash = billHash;
            this.data.solarHash = solarHashHex;
            this.data.collegeName = this.currentCollege ? this.currentCollege.name : 'Unknown';

            // Save wallet → college name mapping for leaderboard display
            if (this.userAddress && this.currentCollege) {
                this.saveCollegeMapping(this.userAddress, this.currentCollege.name);
            }

            // 9. Show success
            this.updateDashboardUI(true);
            this.showResultCard(billHash, solarHashHex, txId);
            this.showDashboardTab('overview');

            showToast('success', '🎉 On-Chain Verified!', `TX: ${txId.substring(0, 16)}... | Score: ${greenScore}%`);

            // Reload on-chain data
            setTimeout(() => this.loadOnChainData(), 2000);

        } catch (e) {
            debugLog("error", "Submission failed:", e);
            const msg = e.message || String(e);
            if (msg.includes('cancelled') || msg.includes('rejected')) {
                showToast('warning', 'Cancelled', 'Transaction was cancelled by user.');
            } else {
                showToast('error', 'Transaction Failed', msg.substring(0, 100));
                this.showError('general-error', 'Blockchain transaction failed: ' + msg.substring(0, 200));
            }
        } finally {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
            if (loading) loading.classList.add('hidden');
        }
    },

    // ═══════════════════════════════════════
    // RESULT MODAL
    // ═══════════════════════════════════════
    showResultCard(billHash, solarHash, txId) {
        const tokens = Math.floor(this.data.carbonSaved / 100);
        const el = (id) => document.getElementById(id);

        if (el('modal-carbon')) el('modal-carbon').innerText = this.data.carbonSaved + ' kg CO₂';
        if (el('modal-score')) el('modal-score').innerText = this.data.greenScore + '%';
        if (el('modal-tokens')) el('modal-tokens').innerText = tokens + ' CT';
        if (el('modal-bill-hash')) el('modal-bill-hash').innerText = billHash ? billHash.substring(0, 32) + '...' : '—';
        if (el('modal-solar-hash')) el('modal-solar-hash').innerText = solarHash ? solarHash.substring(0, 32) + '...' : '—';

        // Show TX ID if available
        const txEl = el('modal-tx-id');
        if (txEl && txId) {
            txEl.innerText = txId;
            txEl.parentElement.style.display = 'block';
        }

        const modal = el('result-modal');
        if (modal) modal.classList.remove('hidden');
    },
    closeResultModal() {
        const modal = document.getElementById('result-modal');
        if (modal) modal.classList.add('hidden');
    },

    calculateCarbon(electricity, solar) {
        const carbonPerUnit = 0.82;
        const totalCarbonSaved = solar * carbonPerUnit;
        const greenScore = electricity > 0 ? Math.min((totalCarbonSaved / electricity) * 100, 100) : 0;
        return { totalCarbonSaved, greenScore };
    },

    resetData() {
        // Reset to zeros when wallet disconnects
        this.isOnChainData = false;
        this.data = { ...this.demoData, electricityHash: null, solarHash: null, collegeName: this.currentCollege ? this.currentCollege.name : '' };
        this.updateDashboardUI();
    },

    // ═══════════════════════════════════════
    // BLOCKCHAIN: OPT-IN
    // ═══════════════════════════════════════
    async checkOptIn() {
        if (!this.userAddress || !this.appId || !this.algodClient) return false;
        try {
            const info = await this.algodClient.accountInformation(this.userAddress).do();
            const apps = info['apps-local-state'] || [];
            return apps.some(a => a.id === this.appId);
        } catch (e) {
            debugLog("error", "Opt-in check error:", e);
            return false;
        }
    },

    async optInToApp() {
        if (!this.peraWallet || !this.userAddress || !this.algodClient) return false;
        try {
            this.ensureAlgoSdkReady();
            const suggestedParams = await withTimeout(
                this.algodClient.getTransactionParams().do(),
                30000,
                'Fetching network params'
            );
            const txn = algosdk.makeApplicationOptInTxnFromObject({
                from: this.userAddress,
                appIndex: this.appId,
                suggestedParams
            });

            // Sign via wallet with robust handling across SDK/wallet versions
            const signedBlob = await this.signTxnWithPera(txn);
            const sendResult = await withTimeout(
                this.algodClient.sendRawTransaction(signedBlob).do(),
                45000,
                'Opt-in broadcast'
            );
            const txId = sendResult.txId || sendResult.txid || sendResult.txID || txn.txID();
            await withTimeout(
                algosdk.waitForConfirmation(this.algodClient, txId, 8),
                90000,
                'Opt-in confirmation'
            );
            debugLog("Opt-In confirmed:", txId);
            showToast('success', 'Opted In!', `Smart contract opt-in successful. TX: ${txId.substring(0, 12)}...`);
            return true;
        } catch (e) {
            debugLog("error", "Opt-In failed:", e);
            const msg = e.message || String(e);
            if (msg.includes('cancelled') || msg.includes('rejected')) {
                showToast('warning', 'Cancelled', 'Opt-in was cancelled.');
            } else if (msg.includes('4100') || msg.toLowerCase().includes('network mismatch')) {
                showToast('error', 'Network Mismatch', 'Set Pera Wallet to TestNet, disconnect wallet, reconnect, and retry opt-in.');
            } else {
                showToast('error', 'Opt-In Failed', msg.substring(0, 100));
            }
            return false;
        }
    },

    // ═══════════════════════════════════════
    // LEADERBOARD — FROM ALGORAND INDEXER
    // Reads ALL opted-in wallets' local state
    // ═══════════════════════════════════════
    async fetchLeaderboard() {
        const list = document.getElementById('leaderboard-list');
        if (!list) return;

        if (!this.appId) {
            // No demo data — show empty state
            list.innerHTML = '<div style="text-align:center; padding: 3rem; color: var(--text-secondary);"><div style="font-size: 3rem; margin-bottom: 1rem;">🌱</div><h3 style="color: #fff; margin-bottom: 0.5rem;">No Data Yet</h3><p>Deploy the smart contract & set APP_ID in config.js to see the live on-chain leaderboard.</p></div>';
            showToast('info', 'Setup Required', 'Deploy smart contract & set APP_ID for live on-chain leaderboard.');
            return;
        }

        if (!this.indexerClient) {
            list.innerHTML = '<div style="text-align:center; padding: 2rem; color: var(--danger);">Indexer not available.</div>';
            return;
        }

        list.innerHTML = '<div style="text-align:center; padding: 2rem; color: var(--text-secondary);"><span class="spinner">↻</span> Fetching on-chain data from Algorand Indexer...</div>';

        try {
            debugLog("Fetching leaderboard from Indexer for App ID:", this.appId);

            // Query Algorand Indexer for all accounts opted into this app
            const accountsResponse = await this.indexerClient
                .searchAccounts()
                .applicationID(this.appId)
                .do();

            const accounts = accountsResponse['accounts'] || [];
            debugLog("Found", accounts.length, "opted-in accounts");

            if (accounts.length === 0) {
                list.innerHTML = '<div style="text-align:center; padding: 2rem; color: var(--text-secondary);">No verified submissions yet. Be the first! 🌱<br><br>Connect wallet → Submit data → Appear on leaderboard</div>';
                return;
            }

            // Extract local state from each account
            let leaderboard = [];
            accounts.forEach(acc => {
                const localState = (acc['apps-local-state'] || []).find(a => a.id === this.appId);
                if (!localState || !localState['key-value']) return;

                // Decode key-value pairs
                const state = {};
                localState['key-value'].forEach(kv => {
                    const key = atob(kv.key);
                    state[key] = kv.value.uint !== undefined ? kv.value.uint : 0;
                });

                const greenScore = state['green_score'] || 0;
                if (greenScore > 0) {
                    // Look up saved college name from localStorage
                    const savedName = this.getCollegeMapping(acc.address);
                    const displayName = savedName || `Campus ${acc.address.slice(0, 6)}...${acc.address.slice(-4)}`;
                    const logoText = savedName ? savedName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 4) : acc.address.slice(0, 2).toUpperCase();

                    leaderboard.push({
                        address: acc.address,
                        collegeName: displayName,
                        greenScore: greenScore,
                        carbonSaved: state['carbon_saved'] || 0,
                        electricity: state['electricity'] || 0,
                        solar: state['solar'] || 0,
                        tokensEarned: state['tokens_earned'] || 0,
                        hasBadge: state['has_badge'] || 0,
                        logo: makeSvgLogo(logoText)
                    });
                }
            });

            // Sort by green_score descending
            leaderboard.sort((a, b) => b.greenScore - a.greenScore);

            debugLog("Leaderboard entries:", leaderboard.length);

            if (leaderboard.length === 0) {
                list.innerHTML = '<div style="text-align:center; padding: 2rem; color: var(--text-secondary);">Accounts found but no valid scores yet. Submit your data! 🌿</div>';
                return;
            }

            this.renderLeaderboardData(leaderboard);
            showToast('success', 'Leaderboard Loaded', `${leaderboard.length} campus(es) ranked from on-chain data.`);

        } catch (e) {
            debugLog("error", "Indexer Leaderboard Error:", e);
            list.innerHTML = `<div style="text-align:center; padding: 2rem; color: var(--danger);">Failed to fetch on-chain data.<br><small>${escapeHtml(e.message || String(e))}</small></div>`;
        }
    },

    renderLeaderboardData(data) {
        const list = document.getElementById('leaderboard-list');
        if (!list) return;

        let html = '';
        data.forEach((c, i) => {
            let badgeStyle = 'background: rgba(255,255,255,0.1); color: #fff;';
            let cardExtra = '';
            let medalIcon = '';

            if (i === 0) {
                badgeStyle = 'background: linear-gradient(135deg, #ffd700, #b8860b); color: #000; box-shadow: 0 0 10px rgba(255,215,0,0.4);';
                cardExtra = 'border-color: rgba(255,215,0,0.3); transform: scale(1.02);';
                medalIcon = '🥇 ';
            } else if (i === 1) {
                badgeStyle = 'background: linear-gradient(135deg, #e0e0e0, #a0a0a0); color: #000;';
                medalIcon = '🥈 ';
            } else if (i === 2) {
                badgeStyle = 'background: linear-gradient(135deg, #cd7f32, #8b4513); color: #000;';
                medalIcon = '🥉 ';
            }

            const badgeLabel = c.hasBadge ? ' 🏆' : '';
            const tokenLabel = c.tokensEarned > 0 ? ` | ${c.tokensEarned} CT` : '';

            html += `
            <div class="glass-panel rank-card" style="${cardExtra}">
               <div class="rank-badge" style="${badgeStyle}">${i + 1}</div>
               <img src="${safeLogoUrl(c.logo)}" alt="${escapeHtml(c.collegeName)}">
               <div class="rank-info">
                   <div class="rank-name">${medalIcon}${escapeHtml(c.collegeName)}${badgeLabel}</div>
                   <div style="font-size: 0.75rem; color: var(--text-secondary);">⚡ ${c.electricity} kWh | ☀️ ${c.solar} kWh${tokenLabel}</div>
               </div>
               <div class="rank-score">${escapeHtml(String(c.greenScore))}%</div>
            </div>
            `;
        });
        list.innerHTML = html;
    },

    // ═══════════════════════════════════════
    // UI & NAVIGATION
    // ═══════════════════════════════════════
    updateDashboardUI(animate = false) {
        const animateValue = (id, start, end, duration) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (!animate) { el.innerText = end; return; }
            let ts = null;
            const step = (t) => {
                if (!ts) ts = t;
                const p = Math.min((t - ts) / duration, 1);
                el.innerText = Math.floor(p * (end - start) + start);
                if (p < 1) window.requestAnimationFrame(step);
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

        // Circular Progress Ring
        const circle = document.getElementById("score-ring-circle");
        if (circle) {
            const r = circle.r.baseVal.value;
            const c = r * 2 * Math.PI;
            circle.style.strokeDashoffset = c - (this.data.greenScore / 100) * c;

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

        // Summary Bar
        const sumE = document.getElementById('sum-energy');
        const sumS = document.getElementById('sum-solar-ratio');
        const sumI = document.getElementById('sum-impact');
        if (sumE) sumE.innerText = this.data.electricity + ' kWh';
        if (sumS) {
            const ratio = this.data.electricity > 0 ? Math.round((this.data.solar / this.data.electricity) * 100) : 0;
            sumS.innerText = ratio + '%';
        }
        if (sumI) {
            if (this.data.greenScore > 75) { sumI.innerText = 'Excellent'; sumI.style.color = '#00ff88'; }
            else if (this.data.greenScore >= 40) { sumI.innerText = 'Moderate'; sumI.style.color = '#f59e0b'; }
            else { sumI.innerText = this.data.greenScore > 0 ? 'Low' : '—'; sumI.style.color = this.data.greenScore > 0 ? '#ef4444' : 'var(--text-secondary)'; }
        }
    },

    updatePreview() {
        const elec = parseFloat(document.getElementById('electricity').value) || 0;
        const solar = parseFloat(document.getElementById('solar').value) || 0;
        const result = this.calculateCarbon(elec, solar);
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
            const el = document.getElementById(id); if (el) el.classList.add('hidden');
        });
    },
    showHome() {
        this.closeMobileMenu(); this.hideAllSections();
        document.getElementById('home-page').classList.remove('hidden');
        document.querySelector('.navbar').classList.remove('hidden');
        document.querySelector('.footer').classList.remove('hidden');
    },
    showLogin() {
        this.closeMobileMenu(); this.hideAllSections();
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
        // Load fresh on-chain data when dashboard opens
        if (this.userAddress && this.appId) this.loadOnChainData();
    },
    showDashboardTab(tabName) {
        const t1 = document.getElementById('tab-overview');
        const t2 = document.getElementById('tab-submit');
        if (t1) t1.classList.add('hidden');
        if (t2) t2.classList.add('hidden');
        const target = document.getElementById('tab-' + tabName);
        if (target) target.classList.remove('hidden');
        document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
        const nav = document.getElementById('nav-' + tabName);
        if (nav) nav.classList.add('active');
    },
    showLeaderboard(isPublic = true) {
        this.closeMobileMenu(); this.hideAllSections();
        document.getElementById('leaderboard-page').classList.remove('hidden');
        if (isPublic) document.querySelector('.navbar').classList.remove('hidden');
        else document.querySelector('.navbar').classList.add('hidden');
        document.querySelector('.footer').classList.remove('hidden');
        this.fetchLeaderboard();
    },



    // Auth — reads user-entered college name, then navigates to dashboard
    login() {
        const btn = document.getElementById('login-btn');
        const old = btn ? btn.innerText : 'Login';
        if (btn) btn.innerText = 'Logging in...';

        // Read the user-entered college name
        const collegeInput = document.getElementById('collage-select');
        const collegeName = collegeInput ? collegeInput.value.trim() : '';
        if (!collegeName) {
            if (btn) btn.innerText = old;
            showToast('error', 'College Required', 'Please enter your college name.');
            return;
        }
        this.setCollegeName(collegeName);

        setTimeout(() => {
            if (btn) btn.innerText = old;
            this.showDashboard();
            showToast('success', 'Welcome!', `${collegeName} Dashboard`);
        }, 800);
    },
    logout() {
        this.currentCollege = null;
        this.data.collegeName = '';
        this.showHome();
        showToast('info', 'Logged Out', 'Session ended.');
    },

    // ═══════════════════════════════════════
    // COLLEGE NAME ↔ WALLET MAPPING
    // Stored in localStorage for leaderboard display
    // ═══════════════════════════════════════
    saveCollegeMapping(walletAddress, collegeName) {
        try {
            const map = JSON.parse(localStorage.getItem('greenova_college_map') || '{}');
            map[walletAddress] = collegeName;
            localStorage.setItem('greenova_college_map', JSON.stringify(map));
            debugLog('Saved college mapping:', walletAddress.slice(0, 8) + '... →', collegeName);
        } catch (e) {
            debugLog('warn', 'Failed to save college mapping:', e);
        }
    },
    getCollegeMapping(walletAddress) {
        try {
            const map = JSON.parse(localStorage.getItem('greenova_college_map') || '{}');
            return map[walletAddress] || null;
        } catch (e) {
            return null;
        }
    },

    // Wallet
    async connectWallet() {
        // If peraWallet wasn't initialized during init(), try again now (late load)
        if (!this.peraWallet) {
            debugLog('warn', 'Pera not initialized, attempting late init...');
            try {
                let PeraWalletClass = null;
                if (window.PeraWalletConnect && typeof window.PeraWalletConnect.PeraWalletConnect === 'function') {
                    PeraWalletClass = window.PeraWalletConnect.PeraWalletConnect;
                } else if (typeof window.PeraWalletConnect === 'function') {
                    PeraWalletClass = window.PeraWalletConnect;
                } else if (window.PeraWalletConnect && typeof window.PeraWalletConnect.default === 'function') {
                    PeraWalletClass = window.PeraWalletConnect.default;
                }
                if (PeraWalletClass) {
                    this.peraWalletCtor = PeraWalletClass;
                    this.peraWallet = this.createPeraWalletInstance();
                    debugLog('✅ Pera late-initialized successfully');
                }
            } catch (e) {
                debugLog('error', 'Late Pera init failed:', e);
            }
        }

        if (!this.peraWallet) {
            showToast('error', 'Wallet Error', 'Pera Wallet SDK not loaded. Please refresh the page.');
            return;
        }
        if (this.userAddress) {
            // Disconnect flow
            try {
                await this.peraWallet.disconnect();
            } catch (_) { }
            this.userAddress = null;
            this.resetWalletUI();
            this.resetData();
            this.updateDashboardUI();
            showToast('info', 'Disconnected', 'Wallet disconnected.');
        } else {
            try {
                // Clear stale session so QR modal can open reliably
                try {
                    await this.peraWallet.disconnect();
                } catch (_) { }

                // Re-create instance for a clean connect
                this.peraWallet = this.createPeraWalletInstance();

                const accts = await withTimeout(this.peraWallet.connect(), 60000, 'Wallet connect');
                this.userAddress = accts[0];
                this.updateWalletUI();
                this.loadLogo();
                showToast('success', 'Connected!', `${this.userAddress.slice(0, 6)}...${this.userAddress.slice(-4)}`);
                // Load on-chain data for connected wallet
                this.loadOnChainData();

                // Setup disconnect listener
                this.peraWallet.connector?.on('disconnect', () => {
                    this.userAddress = null;
                    this.resetWalletUI();
                    this.resetData();
                });
            } catch (e) {
                debugLog("error", "Wallet connect:", e);
                const msg = e && e.message ? e.message : String(e);
                if (!msg.includes('cancelled') && !msg.includes('CONNECT_MODAL_CLOSED')) {
                    if (msg.includes('4100') || msg.toLowerCase().includes('network mismatch')) {
                        showToast('error', 'Network Mismatch', 'Set Pera Wallet to TestNet, disconnect wallet, and reconnect.');
                    } else {
                        showToast('error', 'Connection Failed', msg.substring(0, 120));
                    }
                }
            }
        }
    },
    updateWalletUI() {
        const btn = document.getElementById("connectWalletBtn");
        const txt = document.getElementById("walletBtnText");
        const dot = document.getElementById("walletStatusDot");
        if (this.userAddress && btn) {
            btn.classList.add('connected');
            if (txt) txt.innerText = 'Disconnect (' + this.userAddress.slice(0, 4) + '...' + this.userAddress.slice(-4) + ')';
            if (dot) dot.style.background = '#00ff88';
        }
    },
    resetWalletUI() {
        const btn = document.getElementById("connectWalletBtn");
        const txt = document.getElementById("walletBtnText");
        const dot = document.getElementById("walletStatusDot");
        if (btn) btn.classList.remove('connected');
        if (txt) txt.innerText = "Connect Wallet";
        if (dot) dot.style.background = '#ef4444';
    },
};

// ─── BOOTSTRAP ───
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
