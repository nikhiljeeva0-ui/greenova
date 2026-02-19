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

from carbon_contract import app  # Import the Beaker app

load_dotenv()

# Setup logging
logger = logging.getLogger(__name__)


def deploy(use_localnet: bool = False):
    # 1. Initialize Algod Client
    if use_localnet:
        # Use LocalNet defaults (requires: algokit localnet start)
        algod_config = get_default_localnet_config("algod")
        indexer_config = get_default_localnet_config("indexer")
        algod_client = get_algod_client(algod_config)
        indexer_client = get_indexer_client(indexer_config)
        deployer = get_localnet_default_account(algod_client)
    else:
        # Use env vars - set defaults for Testnet (Algonode) if not configured
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

    # 3. Create Application Client (Beaker)
    app_client = ApplicationClient(
        algod_client,
        app,
        signer=signer,
    )

    # 4. Deploy App
    print("Deploying CampusCarbon Smart Contract...")
    app_id, app_addr, tx_id = app_client.create()

    print(f"Deployed successfully! Application ID: {app_id}")
    print(f"Application Address: {app_addr}")
    print(f"Transaction ID: {tx_id}")
    print(f"\nUpdate config.js: APP_ID: {app_id}")

    return app_id


if __name__ == "__main__":
    use_localnet = "--localnet" in sys.argv
    deploy(use_localnet=use_localnet)
