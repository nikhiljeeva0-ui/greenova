/**
 * CampusCarbon application configuration.
 * Update APP_ID after deploying the smart contract - see smart_contracts/INSTRUCTIONS.md
 */
window.CAMPUS_CARBON_CONFIG = {
    // Application ID of the deployed CampusCarbon contract (0 = not deployed)
    // After deploy.py --localnet: set to the printed App ID (e.g. 1002) for LocalNet testing
    // After deploy.py (Testnet): set to your Testnet App ID
    APP_ID: 1002,
    // Set to true to enable console logging (default: false for production)
    DEBUG: false,
    // Algorand network endpoints (optional overrides)
    ALGOD_URL: 'https://testnet-api.algonode.cloud',
    INDEXER_URL: 'https://testnet-idx.algonode.cloud'
};
