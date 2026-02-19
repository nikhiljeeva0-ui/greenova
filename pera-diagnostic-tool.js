/**
 * PERA WALLET DIAGNOSTIC TOOL
 * Paste this entire script into browser console (F12) to diagnose issues
 * 
 * Usage:
 * 1. Open DevTools (F12)
 * 2. Go to Console tab
 * 3. Copy-paste this entire script
 * 4. Run diagnostic tests
 */

(function() {
  console.log('%c🟢 PERA WALLET DIAGNOSTIC TOOL', 'color: #00ff88; font-size: 16px; font-weight: bold; padding: 10px;');
  console.log('Starting comprehensive diagnosis...\n');

  // ============================================
  // GLOBAL DIAGNOSTIC OBJECT
  // ============================================

  window.peradiag = {
    results: {},
    hasErrors: false,

    // ============================================
    // TEST 1: Environment
    // ============================================
    testEnvironment() {
      console.log('%c📍 TEST 1: Environment', 'color: #3b82f6; font-weight: bold;');

      const env = {
        protocol: window.location.protocol,
        hostname: window.location.hostname,
        isLocalhost: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
        isHttps: window.location.protocol === 'https:',
        isSecure: window.location.protocol === 'https:' ||
                  window.location.hostname === 'localhost' ||
                  window.location.hostname === '127.0.0.1'
      };

      console.log('Protocol:', env.protocol);
      console.log('Hostname:', env.hostname);
      console.log('Is Localhost:', env.isLocalhost);
      console.log('Is HTTPS:', env.isHttps);
      console.log('Is Secure Origin:', env.isSecure ? '✅' : '❌');

      if (!env.isSecure) {
        console.error('❌ ERROR: Not served over secure origin!');
        console.error('   Pera SDK requires https:// or localhost');
        this.hasErrors = true;
      }

      this.results.environment = env;
      console.log('');
      return env;
    },

    // ============================================
    // TEST 2: SDK Loading
    // ============================================
    testSDKLoading() {
      console.log('%c📦 TEST 2: SDK Loading', 'color: #3b82f6; font-weight: bold;');

      const sdkLoaded = typeof window.peraWallet !== 'undefined';

      if (sdkLoaded) {
        console.log('✅ Pera SDK is loaded');
        console.log('   Type:', typeof window.peraWallet);
        console.log('   Constructor:', window.peraWallet.constructor.name);

        // Check SDK properties
        console.log('%c   SDK Properties:', 'color: #94a3b8; font-style: italic;');
        console.log('   - isConnected:', window.peraWallet?.isConnected);
        console.log('   - connectedAccounts:', window.peraWallet?.connectedAccounts);
        console.log('   - selectedNetwork:', window.peraWallet?.selectedNetwork);
      } else {
        console.error('❌ ERROR: Pera SDK is NOT loaded!');
        console.error('   Check if CDN script is in HTML');
        console.error('   Expected in <head>: <script src="https://cdn.jsdelivr.net/gh/perawallet/connect-button@1.3.1/dist/perawallet.js"></script>');
        this.hasErrors = true;
      }

      this.results.sdkLoaded = sdkLoaded;
      console.log('');
      return sdkLoaded;
    },

    // ============================================
    // TEST 3: Browser APIs
    // ============================================
    testBrowserAPIs() {
      console.log('%c🌐 TEST 3: Browser APIs', 'color: #3b82f6; font-weight: bold;');

      const apis = {
        crypto: typeof window.crypto !== 'undefined',
        localStorage: this.testLocalStorage(),
        indexedDB: 'indexedDB' in window,
        fetch: typeof fetch !== 'undefined',
        promises: typeof Promise !== 'undefined',
        asyncAwait: true // Always available in modern browsers
      };

      Object.entries(apis).forEach(([api, available]) => {
        console.log(`${available ? '✅' : '❌'} ${api}: ${available}`);
      });

      if (!apis.crypto) {
        console.error('❌ Crypto API missing - Web3 won\'t work');
        this.hasErrors = true;
      }

      this.results.browserAPIs = apis;
      console.log('');
      return apis;
    },

    testLocalStorage() {
      try {
        const test = '__test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
      } catch (e) {
        return false;
      }
    },

    // ============================================
    // TEST 4: Network Requests
    // ============================================
    testNetworkRequests() {
      console.log('%c🌍 TEST 4: Network Requests', 'color: #3b82f6; font-weight: bold;');
      console.log('Open Network tab (F12) to verify:');
      console.log('1. perawallet.js CDN loads (not 404)');
      console.log('2. No CORS errors in console');
      console.log('3. Algorand RPC endpoints accessible');
      console.log('%cManual check required in Network tab.', 'color: #f59e0b; font-style: italic;');
      console.log('');
    },

    // ============================================
    // TEST 5: Connection Test
    // ============================================
    async testConnection() {
      console.log('%c🔗 TEST 5: Connection Test', 'color: #3b82f6; font-weight: bold;');

      if (!window.peraWallet) {
        console.error('❌ SDK not loaded - skipping connection test');
        this.results.connection = { status: 'skipped', reason: 'SDK not loaded' };
        console.log('');
        return false;
      }

      try {
        const isConnected = window.peraWallet?.isConnected;
        const accounts = window.peraWallet?.connectedAccounts || [];

        if (isConnected && accounts.length > 0) {
          console.log('✅ Already connected');
          console.log('   Accounts:', accounts);
          console.log('   First account:', accounts[0]);
          this.results.connection = { status: 'connected', accounts };
        } else {
          console.log('ℹ️  Not currently connected');
          console.log('   To test connection, user must approve in Pera popup');
          this.results.connection = { status: 'not-connected' };
        }
      } catch (error) {
        console.error('❌ Connection test failed:', error.message);
        this.results.connection = { status: 'error', error: error.message };
      }

      console.log('');
    },

    // ============================================
    // TEST 6: Event Listeners
    // ============================================
    testEventListeners() {
      console.log('%c🔔 TEST 6: Event Listeners', 'color: #3b82f6; font-weight: bold;');

      if (!window.peraWallet) {
        console.log('ℹ️  Skipping - SDK not loaded');
        console.log('');
        return;
      }

      try {
        const events = ['connect', 'disconnect', 'error', 'network'];
        let listenersAdded = 0;

        events.forEach(event => {
          if (window.peraWallet.connector?.on) {
            window.peraWallet.connector.on(event, (data) => {
              console.log(`%c🔔 Event: ${event}`, 'color: #10b981; font-weight: bold;');
              console.log('   Data:', data);
            });
            listenersAdded++;
            console.log(`✅ Listener added for '${event}'`);
          }
        });

        console.log(`%c✅ Total listeners attached: ${listenersAdded}`, 'color: #10b981; font-weight: bold;');
        this.results.eventListeners = { count: listenersAdded, attached: events.slice(0, listenersAdded) };
      } catch (error) {
        console.error('❌ Error attaching listeners:', error.message);
      }

      console.log('');
    },

    // ============================================
    // TEST 7: localStorage Check
    // ============================================
    testLocalStorageData() {
      console.log('%c💾 TEST 7: localStorage Sessions', 'color: #3b82f6; font-weight: bold;');

      try {
        const sessions = Object.keys(localStorage).filter(key => key.includes('pera'));

        if (sessions.length === 0) {
          console.log('ℹ️  No saved Pera sessions');
        } else {
          console.log(`✅ Found ${sessions.length} saved sessions:`);
          sessions.forEach(key => {
            const data = localStorage.getItem(key);
            try {
              const parsed = JSON.parse(data);
              console.log(`   ${key}:`, {
                accounts: parsed.accounts?.length || 0,
                network: parsed.network,
                age: new Date() - new Date(parsed.timestamp)
              });
            } catch (e) {
              console.log(`   ${key}: (invalid JSON)`);
            }
          });
        }

        this.results.localStorage = { sessions };
      } catch (error) {
        console.error('❌ Error checking localStorage:', error.message);
      }

      console.log('');
    },

    // ============================================
    // TEST 8: Quick Connection Test
    // ============================================
    async testQuickConnection() {
      console.log('%c⚡ TEST 8: Manual Connection Test', 'color: #3b82f6; font-weight: bold;');

      if (!window.peraWallet) {
        console.log('ℹ️  Skipping - SDK not loaded');
        console.log('');
        return;
      }

      try {
        console.log('Attempting connection... (popup should open)');
        const accounts = await window.peraWallet.connect();

        if (accounts && accounts.length > 0) {
          console.log('%c✅ CONNECTION SUCCESSFUL!', 'color: #10b981; font-weight: bold; font-size: 14px;');
          console.log('   Connected account:', accounts[0]);
          this.results.quickConnect = { status: 'success', accounts };
        } else {
          console.log('ℹ️  Connection cancelled by user');
          this.results.quickConnect = { status: 'cancelled' };
        }
      } catch (error) {
        console.error('❌ Connection failed:', error.message);
        console.error('   Error code:', error.code);
        console.error('   Full error:', error);
        this.results.quickConnect = { status: 'failed', error: error.message };
      }

      console.log('');
    },

    // ============================================
    // TEST 9: Network Configuration
    // ============================================
    testNetworkConfig() {
      console.log('%c🌐 TEST 9: Network Configuration', 'color: #3b82f6; font-weight: bold;');

      if (!window.peraWallet) {
        console.log('ℹ️  Skipping - SDK not loaded');
        console.log('');
        return;
      }

      try {
        const network = window.peraWallet?.selectedNetwork;
        const config = window.peraWallet?.config || {};

        console.log('Selected Network:', network);
        console.log('Genesis ID:', config.genesisID || 'Not set');

        // Verify network config
        const validNetworks = {
          testnet: 'SGO1GKSCTMiMjGTguri5kbb7Fesxtg5yBkknyhZr5Z8=',
          mainnet: 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8='
        };

        if (network === 'testnet') {
          console.log('✅ Network is testnet (development)');
          console.log('   Fund account at: https://bank.sandbox.algorand.network');
        } else if (network === 'mainnet') {
          console.log('✅ Network is mainnet (production)');
          console.log('   Real ALGO - be careful!');
        } else {
          console.warn('⚠️  Unknown network:', network);
        }

        this.results.networkConfig = { network, genesisID: config.genesisID };
      } catch (error) {
        console.error('❌ Error checking network:', error.message);
      }

      console.log('');
    },

    // ============================================
    // DIAGNOSTIC SUMMARY
    // ============================================
    printSummary() {
      console.log('%c═══════════════════════════════════', 'color: #00ff88; font-weight: bold;');
      console.log('%c📊 DIAGNOSTIC SUMMARY', 'color: #00ff88; font-weight: bold; font-size: 14px;');
      console.log('%c═══════════════════════════════════', 'color: #00ff88; font-weight: bold;');

      console.log('\n%cStatus Overview:', 'color: #3b82f6; font-weight: bold;');
      console.log(JSON.stringify(this.results, null, 2));

      console.log('\n%cRecommendations:', 'color: #f59e0b; font-weight: bold;');

      if (this.hasErrors) {
        console.error('❌ Critical issues found:');
        if (!this.results.environment?.isSecure) {
          console.error('   1. Not served from secure origin');
          console.error('      Use: http://localhost or https://');
        }
        if (!this.results.sdkLoaded) {
          console.error('   2. Pera SDK not loaded');
          console.error('      Add CDN script to HTML');
        }
      } else {
        console.log('✅ All checks passed!');
      }

      console.log('\n%cNext Steps:', 'color: #10b981; font-weight: bold;');
      console.log('1. Check browser console for detailed errors');
      console.log('2. Verify Network tab (F12) for failed requests');
      console.log('3. Check popup blocker settings');
      console.log('4. Try manual connection test (see above)');

      console.log('\n%cUseful Commands:', 'color: #94a3b8; font-weight: bold;');
      console.log('  peradiag.testQuickConnection()  - Test popup');
      console.log('  peradiag.printResults()         - Show full results');
      console.log('  peraWallet.connect()            - Manually open popup');
      console.log('  peraWallet.disconnect()         - Disconnect wallet');

      console.log('\n%c═══════════════════════════════════', 'color: #00ff88; font-weight: bold;');
    },

    // ============================================
    // RUN ALL TESTS
    // ============================================
    async runAll() {
      console.clear();
      console.log('%c🟢 PERA WALLET DIAGNOSTIC TOOL v1.0', 'color: #00ff88; font-size: 18px; font-weight: bold;');
      console.log('%cComprehensive Diagnostics\n', 'color: #94a3b8; font-style: italic;');

      this.testEnvironment();
      this.testSDKLoading();
      this.testBrowserAPIs();
      this.testNetworkRequests();
      await this.testConnection();
      this.testEventListeners();
      this.testLocalStorageData();
      this.testNetworkConfig();

      this.printSummary();

      return this.results;
    },

    // Helper method to print results
    printResults() {
      console.table(this.results);
    }
  };

  // ============================================
  // AUTO-RUN QUICK CHECKS
  // ============================================

  console.log('%c🔍 Running auto-checks...', 'color: #3b82f6; font-weight: bold;');
  console.log('');

  // Quick environment check
  const isSecure = window.location.protocol === 'https:' ||
                   window.location.hostname === 'localhost' ||
                   window.location.hostname === '127.0.0.1';

  if (!isSecure) {
    console.error('%c⚠️  WARNING: Not on secure origin!', 'background: #ef4444; color: white; padding: 4px 8px; border-radius: 4px;');
    console.error('   Pera SDK requires https:// or http://localhost');
  }

  // Check SDK
  if (typeof window.peraWallet === 'undefined') {
    console.warn('%c⚠️  Pera SDK not loaded yet', 'background: #f59e0b; color: black; padding: 4px 8px; border-radius: 4px;');
    console.log('   Verify CDN script is in HTML <head>');
  } else {
    console.log('%c✅ Pera SDK is loaded', 'color: #10b981; font-weight: bold;');
  }

  console.log('\n%c💡 To run full diagnostics, type: peradiag.runAll()', 'color: #00ff88; font-weight: bold;');
  console.log('%c💡 To test connection popup, type: peradiag.testQuickConnection()', 'color: #00ff88; font-weight: bold;');
  console.log('\n');
})();
