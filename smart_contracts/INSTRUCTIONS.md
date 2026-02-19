# 🚀 CampusCarbon Smart Contract Deployment Guide

Follow these exact steps to deploy your smart contract to Algorand Testnet.

## 1. Setup Environment
Open your terminal in VS Code (`Ctrl+` `) and ensure you are in the project root:

```sh
cd /Users/nikhiljeeva0gmail.com/hackaton
```

### Install AlgoKit & Dependencies
If you have `pipx` installed (recommended):
```sh
pipx install algokit
```
Or via pip (user method):
```sh
pip3 install --user algokit
```
Ensure `~/.local/bin` is in your PATH.

Then, initialize the project dependencies:
```sh
cd smart_contracts
python3 -m venv venv
source venv/bin/activate
pip install beaker-pyteal algokit-utils python-dotenv
```

## 2. Configure Testnet
You need a funded Testnet account.
1. Create a wallet on [Pera Wallet Testnet](https://perawallet.app/) or use `algokit task wallet`.
2. Fund it using the [Testnet Dispenser](https://bank.testnet.algorand.network/).
3. Copy your **25-word mnemonic**.

Create a `.env` file in the `smart_contracts` directory (copy from `.env.example`):
```sh
cd smart_contracts
cp .env.example .env
```
Edit `.env` and set `DEPLOYER_MNEMONIC` to your 25-word mnemonic. **Never commit .env to git!**

## 3. Deploy
Run the deployment script:

```sh
python3 deploy.py
```

## 4. Get App ID
The script will output:
```
Deployed successfully! Application ID: 12345678
```
Copy this ID.

## 5. Connect to Frontend
Open `config.js` and set the `APP_ID` to your deployed application ID:

```javascript
window.CAMPUS_CARBON_CONFIG = {
    APP_ID: 12345678,  // Replace with your new App ID
    ...
};
```

Now your frontend is ready to call `submit_data` on this App ID!
