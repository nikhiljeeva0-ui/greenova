import logging
import os
import sys

import algosdk
from beaker.client import ApplicationClient
from algokit_utils import (
    get_algod_client,
    get_default_localnet_config,
    get_indexer_client,
    get_localnet_default_account,
    get_account_from_mnemonic,
)
from algosdk.atomic_transaction_composer import AccountTransactionSigner
from dotenv import load_dotenv

from carbon_contract import app  # Import the enhanced Beaker app

load_dotenv()

logger = logging.getLogger(__name__)


def deploy(use_localnet: bool = False):
    """Deploy the CampusCarbon smart contract."""
    # 1. Initialize Algod Client
    if use_localnet:
        algod_config = get_default_localnet_config("algod")
        indexer_config = get_default_localnet_config("indexer")
        algod_client = get_algod_client(algod_config)
        indexer_client = get_indexer_client(indexer_config)
        deployer = get_localnet_default_account(algod_client)
    else:
        # Testnet (Algonode)
        if not os.environ.get("ALGOD_SERVER"):
            os.environ.setdefault("ALGOD_SERVER", "https://testnet-api.algonode.cloud")
            os.environ.setdefault("ALGOD_TOKEN", "")
        if not os.environ.get("INDEXER_SERVER"):
            os.environ.setdefault("INDEXER_SERVER", "https://testnet-idx.algonode.cloud")
            os.environ.setdefault("INDEXER_TOKEN", "")
        algod_client = get_algod_client()
        indexer_client = get_indexer_client()
        mnemonic = os.environ.get("DEPLOYER_MNEMONIC")
        if not mnemonic:
            raise RuntimeError(
                "DEPLOYER_MNEMONIC environment variable is required for Testnet. "
                "Set it in .env or use --localnet for LocalNet deployment."
            )
        deployer = get_account_from_mnemonic(mnemonic)

    signer = AccountTransactionSigner(deployer.private_key)

    # 2. Create Application Client
    app_client = ApplicationClient(
        algod_client,
        app,
        signer=signer,
    )

    # 3. Deploy
    print("=" * 50)
    print("🚀 Deploying CampusCarbon Smart Contract...")
    print("=" * 50)

    app_id, app_addr, tx_id = app_client.create()

    print(f"\n✅ Deployed successfully!")
    print(f"   Application ID:      {app_id}")
    print(f"   Application Address: {app_addr}")
    print(f"   Transaction ID:      {tx_id}")
    print(f"\n📝 NEXT STEP: Update config.js with:")
    print(f"   APP_ID: {app_id}")
    print("=" * 50)

    # 4. Export contract ABI
    try:
        app.build().export("./artifacts")
        print("📦 ABI artifacts exported to ./artifacts/")
    except Exception as e:
        print(f"⚠️ Could not export artifacts: {e}")

    return app_id


if __name__ == "__main__":
    use_localnet = "--localnet" in sys.argv
    deploy(use_localnet=use_localnet)
