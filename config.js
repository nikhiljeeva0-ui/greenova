/**
 * Greenova Configuration
 * 
 * Set APP_ID after deploying your smart contract.
 * Default endpoints point to Algorand Testnet (public nodes).
 * For LocalNet development, change to localhost:4001 / localhost:8980.
 */
window.CAMPUS_CARBON_CONFIG = {
    // ═══ APP ID — Set this after deploying your smart contract ═══
    APP_ID: 756081706,

    // Enable console logging
    DEBUG: true,

    // Algorand Testnet endpoints (public, no token needed)
    ALGOD_URL: 'https://testnet-api.algonode.cloud',
    ALGOD_TOKEN: '',
    INDEXER_URL: 'https://testnet-idx.algonode.cloud'
};
