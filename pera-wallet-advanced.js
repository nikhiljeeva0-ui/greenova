/**
 * PERA WALLET ADVANCED CONFIGURATION GUIDE
 * Production-ready setup patterns & best practices
 */

// ============================================
// 1. ENVIRONMENT-BASED CONFIGURATION
// ============================================

const PeraConfig = {
  // Environment detection
  environments: {
    development: {
      network: 'testnet',
      genesisID: 'SGO1GKSCTMiMjGTguri5kbb7Fesxtg5yBkknyhZr5Z8=',
      nodeURL: 'https://node.testnet.algoexplorerapi.io',
      indexerURL: 'https://indexer.testnet.algoexplorerapi.io',
      explorerURL: 'https://testnet.algoexplorer.io',
      dispenser: 'https://bank.sandbox.algorand.network',
      logging: true,
      strictValidation: false
    },
    staging: {
      network: 'testnet',
      genesisID: 'SGO1GKSCTMiMjGTguri5kbb7Fesxtg5yBkknyhZr5Z8=',
      nodeURL: 'https://node.testnet.algoexplorerapi.io',
      indexerURL: 'https://indexer.testnet.algoexplorerapi.io',
      explorerURL: 'https://testnet.algoexplorer.io',
      logging: true,
      strictValidation: true
    },
    production: {
      network: 'mainnet',
      genesisID: 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
      nodeURL: 'https://node.algoexplorerapi.io',
      indexerURL: 'https://indexer.algoexplorerapi.io',
      explorerURL: 'https://algoexplorer.io',
      logging: false,
      strictValidation: true
    }
  },

  /**
   * Get configuration for current environment
   */
  getCurrentConfig: function() {
    const env = process.env.NODE_ENV || 'development';
    const config = this.environments[env];
    if (!config) throw new Error(`Unknown environment: ${env}`);
    return config;
  },

  /**
   * Validate configuration
   */
  validate: function(config) {
    const required = ['network', 'genesisID', 'nodeURL'];
    for (const field of required) {
      if (!config[field]) throw new Error(`Missing config field: ${field}`);
    }
    return true;
  }
};

// ============================================
// 2. SECURE SDK INITIALIZATION
// ============================================

class PeraWalletManager {
  constructor(config = null) {
    this.config = config || PeraConfig.getCurrentConfig();
    PeraConfig.validate(this.config);

    this.wallet = null;
    this.isConnected = false;
    this.accounts = [];
    this.sessionKey = `pera_session_${this.config.network}`;

    this.logger = this.config.logging ? console : { log: () => {}, error: () => {} };
  }

  /**
   * Initialize wallet - call once on app startup
   */
  async initialize() {
    try {
      this.logger.log('🚀 Initializing Pera Wallet...');

      // Preflight checks
      this.performPreflightChecks();

      // Verify SDK
      if (typeof peraWallet === 'undefined') {
        throw new Error('Pera SDK not available. Check CDN link in HTML.');
      }

      // Create wallet instance
      this.wallet = new peraWallet({
        shouldShowSignTxnToast: true,
        shouldShowHints: true,
        network: this.config.network,
        genesisID: this.config.genesisID
      });

      // Attach event listeners
      this.attachEventListeners();

      // Try to restore previous session
      await this.restoreSession();

      this.logger.log('✅ Pera Wallet initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('❌ Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Perform preflight checks
   */
  performPreflightChecks() {
    const checks = {
      'Secure origin (https or localhost)': this.isSecureOrigin(),
      'Web3 API available': typeof window.crypto !== 'undefined',
      'localStorage available': this.isLocalStorageAvailable(),
      'IndexedDB available': 'indexedDB' in window
    };

    Object.entries(checks).forEach(([check, passed]) => {
      const status = passed ? '✅' : '⚠️';
      this.logger.log(`${status} ${check}`);
    });
  }

  /**
   * Check if origin is secure
   */
  isSecureOrigin() {
    return window.location.protocol === 'https:' ||
           window.location.hostname === 'localhost' ||
           window.location.hostname === '127.0.0.1';
  }

  /**
   * Check localStorage availability
   */
  isLocalStorageAvailable() {
    try {
      const test = '__test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    this.wallet.connector?.on('connect', (accounts) => {
      this.handleConnect(accounts);
    });

    this.wallet.connector?.on('disconnect', () => {
      this.handleDisconnect();
    });

    this.wallet.connector?.on('network', (network) => {
      this.handleNetworkChange(network);
    });

    this.wallet.connector?.on('error', (error) => {
      this.handleError(error);
    });

    // Listen for wallet updates
    window.addEventListener('visibilitychange', () => {
      if (document.hidden === false) {
        this.logger.log('Page became visible, checking wallet status...');
        this.checkConnectionStatus();
      }
    });
  }

  /**
   * Connect to wallet
   */
  async connect() {
    if (!this.wallet) {
      throw new Error('Wallet not initialized. Call initialize() first.');
    }

    try {
      this.logger.log('📱 Opening Pera Wallet popup...');

      const accounts = await this.wallet.connect();

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned from connection');
      }

      this.accounts = accounts;
      this.isConnected = true;

      // Save session
      this.saveSession(accounts);

      this.logger.log('✅ Connected:', accounts);
      return accounts;
    } catch (error) {
      this.logger.error('Connection failed:', error);
      throw error;
    }
  }

  /**
   * Disconnect from wallet
   */
  async disconnect() {
    try {
      if (this.wallet && this.isConnected) {
        await this.wallet.disconnect();
      }

      this.accounts = [];
      this.isConnected = false;
      this.clearSession();

      this.logger.log('✅ Disconnected');
      return true;
    } catch (error) {
      this.logger.error('Disconnect failed:', error);
      throw error;
    }
  }

  /**
   * Switch network
   */
  async switchNetwork(newNetwork) {
    const newConfig = PeraConfig.environments[newNetwork];
    if (!newConfig) throw new Error(`Unknown network: ${newNetwork}`);

    this.logger.log(`🌐 Switching to ${newNetwork}...`);

    // Disconnect from current network
    if (this.isConnected) {
      await this.disconnect();
    }

    // Update configuration
    this.config = newConfig;
    this.sessionKey = `pera_session_${this.config.network}`;

    // Reinitialize with new network
    await this.initialize();

    this.logger.log(`✅ Switched to ${newNetwork}`);
  }

  /**
   * Sign transaction
   */
  async signTransaction(txns) {
    if (!this.isConnected) {
      throw new Error('Wallet not connected');
    }

    try {
      this.logger.log('📝 Signing transactions...');

      const signedTxns = await this.wallet.signTxns(txns);

      this.logger.log('✅ Transactions signed');
      return signedTxns;
    } catch (error) {
      this.logger.error('Transaction signing failed:', error);
      throw error;
    }
  }

  /**
   * Save session to localStorage
   */
  saveSession(accounts) {
    try {
      const session = {
        accounts,
        network: this.config.network,
        timestamp: Date.now()
      };
      localStorage.setItem(this.sessionKey, JSON.stringify(session));
      this.logger.log('✅ Session saved');
    } catch (error) {
      this.logger.error('Failed to save session:', error);
    }
  }

  /**
   * Restore session from localStorage
   */
  async restoreSession() {
    try {
      const saved = localStorage.getItem(this.sessionKey);
      if (!saved) {
        this.logger.log('ℹ️ No previous session found');
        return false;
      }

      const session = JSON.parse(saved);

      // Only restore if less than 7 days old
      const sessionAge = Date.now() - session.timestamp;
      const sevenDays = 7 * 24 * 60 * 60 * 1000;

      if (sessionAge > sevenDays) {
        this.logger.log('ℹ️ Session expired');
        this.clearSession();
        return false;
      }

      // Try to reconnect
      const accounts = await this.wallet.reconnectSession();
      if (accounts && accounts.length > 0) {
        this.accounts = accounts;
        this.isConnected = true;
        this.logger.log('✅ Session restored:', accounts);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.log('ℹ️ Session restoration failed:', error);
      this.clearSession();
      return false;
    }
  }

  /**
   * Clear saved session
   */
  clearSession() {
    localStorage.removeItem(this.sessionKey);
    this.logger.log('✅ Session cleared');
  }

  /**
   * Check connection status
   */
  async checkConnectionStatus() {
    if (!this.wallet) return false;

    try {
      const connectedAccounts = this.wallet.connectedAccounts;
      this.isConnected = connectedAccounts && connectedAccounts.length > 0;
      return this.isConnected;
    } catch (error) {
      this.logger.error('Status check failed:', error);
      return false;
    }
  }

  /**
   * Event handlers
   */
  handleConnect(accounts) {
    this.accounts = accounts;
    this.isConnected = true;
    this.saveSession(accounts);
    this.dispatchEvent('pera:connected', { accounts });
  }

  handleDisconnect() {
    this.accounts = [];
    this.isConnected = false;
    this.clearSession();
    this.dispatchEvent('pera:disconnected');
  }

  handleNetworkChange(network) {
    this.logger.log(`🌐 Network changed to: ${network}`);
    this.dispatchEvent('pera:network-changed', { network });
  }

  handleError(error) {
    this.logger.error('❌ Wallet error:', error);
    this.dispatchEvent('pera:error', { error });
  }

  /**
   * Custom event dispatch helper
   */
  dispatchEvent(eventName, detail) {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  }

  /**
   * Get current account
   */
  getCurrentAccount() {
    return this.accounts[0] || null;
  }

  /**
   * Get all accounts
   */
  getAccounts() {
    return [...this.accounts];
  }

  /**
   * Check if account connected
   */
  isAccountConnected(account) {
    return this.accounts.includes(account);
  }
}

// ============================================
// 3. USAGE EXAMPLES
// ============================================

/**
 * Example 1: Basic Setup
 */
async function exampleBasicSetup() {
  try {
    const manager = new PeraWalletManager();
    await manager.initialize();

    // Setup event listeners
    window.addEventListener('pera:connected', (e) => {
      console.log('Connected:', e.detail.accounts);
    });

    window.addEventListener('pera:disconnected', () => {
      console.log('Disconnected');
    });

    return manager;
  } catch (error) {
    console.error('Setup failed:', error);
  }
}

/**
 * Example 2: Production Deployment
 */
async function exampleProductionSetup() {
  // Configuration from environment
  const config = Object.assign(
    PeraConfig.environments.production,
    {
      // Can override with environment variables
      network: process.env.REACT_APP_NETWORK || 'mainnet'
    }
  );

  const manager = new PeraWalletManager(config);
  await manager.initialize();

  return manager;
}

/**
 * Example 3: Multi-Network Support
 */
async function exampleMultiNetwork() {
  const manager = new PeraWalletManager(PeraConfig.environments.testnet);
  await manager.initialize();

  // Later, switch to mainnet
  const button = document.getElementById('switchToMainnet');
  button.addEventListener('click', async () => {
    try {
      await manager.switchNetwork('mainnet');
      // Wallet automatically reconnects
    } catch (error) {
      console.error('Switch failed:', error);
    }
  });

  return manager;
}

/**
 * Example 4: with Transaction Signing
 */
async function exampleWithTransactionSigning(manager) {
  try {
    // Create transaction
    const suggestedParams = {
      // Get from algod
      flatFee: true,
      fee: 1000,
      firstRound: 1000,
      lastRound: 2000,
      genesisID: manager.config.genesisID,
      genesisHash: manager.config.genesisID
    };

    const txn = {
      to: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HVY',
      amount: 1000000,
      from: manager.getCurrentAccount(),
      ...suggestedParams
    };

    // Sign with Pera
    const signedTxns = await manager.signTransaction([txn]);
    console.log('Signed:', signedTxns);

    return signedTxns;
  } catch (error) {
    console.error('Signing failed:', error);
  }
}

// ============================================
// 4. EXPORT FOR MODULE SYSTEMS
// ============================================

// For CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PeraConfig,
    PeraWalletManager,
    exampleBasicSetup,
    exampleProductionSetup,
    exampleMultiNetwork,
    exampleWithTransactionSigning
  };
}

// For ES6 modules, uncomment:
// export { PeraConfig, PeraWalletManager };
// export { exampleBasicSetup, exampleProductionSetup, exampleMultiNetwork, exampleWithTransactionSigning };

// ============================================
// 5. TYPE DEFINITIONS (TypeScript)
// ============================================

/*
interface IPeraConfig {
  network: 'testnet' | 'mainnet';
  genesisID: string;
  nodeURL: string;
  indexerURL: string;
  explorerURL: string;
  logging?: boolean;
  strictValidation?: boolean;
}

interface IPeraWalletManager {
  initialize(): Promise<boolean>;
  connect(): Promise<string[]>;
  disconnect(): Promise<boolean>;
  signTransaction(txns: any[]): Promise<any[]>;
  getCurrentAccount(): string | null;
  getAccounts(): string[];
}
*/

// ============================================
// 6. ERROR CODES & HANDLING
// ============================================

const ErrorCodes = {
  SDK_NOT_LOADED: 'SDK_NOT_LOADED',
  WALLET_NOT_INITIALIZED: 'WALLET_NOT_INITIALIZED',
  NOT_CONNECTED: 'NOT_CONNECTED',
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  SIGNING_FAILED: 'SIGNING_FAILED',
  NETWORK_SWITCH_FAILED: 'NETWORK_SWITCH_FAILED',
  INVALID_CONFIG: 'INVALID_CONFIG'
};

class PeraError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = 'PeraError';
  }
}

// ============================================
// PRODUCTION CHECKLIST
// ============================================

/*
BEFORE DEPLOYING TO PRODUCTION:

Security:
☐ Environment variables used for network selection
☐ No hardcoded private keys or mnemonics
☐ HTTPS enabled
☐ CORS properly configured
☐ CSP headers set

Functionality:
☐ Tested on mainnet with small amounts
☐ Error handling comprehensive
☐ Session persistence working
☐ Reconnection logic tested
☐ All event handlers working

Network:
☐ Correct genesis ID for mainnet
☐ Node/indexer URLs verified
☐ Transaction fees appropriate
☐ Rate limiting handled

UX:
☐ Loading states shown
☐ Error messages user-friendly
☐ Mobile responsive
☐ Accessible (a11y)
☐ Works in Pera app in-app browser
*/
