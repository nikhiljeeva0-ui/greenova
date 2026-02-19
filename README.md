# CampusCarbon

Blockchain-powered sustainability verification for educational institutions.

## Quick Start

### 1. Run the Frontend
```bash
cd /Users/nikhiljeeva0gmail.com/hackaton
python3 -m http.server 8080
```
Open http://localhost:8080 (or your forwarded port in Codespaces).

### 2. Deploy the Smart Contract

**LocalNet (for development):**
```bash
# Start LocalNet first (requires Docker)
algokit localnet start

# Deploy
cd smart_contracts
python3 -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
python deploy.py --localnet
```

Update `config.js` with the printed App ID.

**Testnet:**
```bash
cd smart_contracts
cp .env.example .env
# Edit .env and add your DEPLOYER_MNEMONIC (25-word wallet phrase)
python deploy.py
```

### 3. Connect Wallet
Install [Pera Wallet](https://perawallet.app/) and connect on the app to submit sustainability data on-chain.
