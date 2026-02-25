const algosdk = require('algosdk');
require('dotenv').config({ path: './smart_contracts/.env' });

async function main() {
    const algodClient = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', '');
    const mn = process.env.DEPLOYER_MNEMONIC;
    if (!mn) return console.error("No mnemonic.");
    const account = algosdk.mnemonicToSecretKey(mn);
    const appId = 756081706;

    console.log("Testing with account:", account.addr);

    try {
        const params = await algodClient.getTransactionParams().do();

        console.log("Sending Opt-In...");
        const optInTxn = algosdk.makeApplicationOptInTxnFromObject({
            from: account.addr,
            appIndex: appId,
            suggestedParams: params
        });

        const signedOptIn = optInTxn.signTxn(account.sk);
        try {
            const { txId } = await algodClient.sendRawTransaction(signedOptIn).do();
            console.log("Opt-In sent:", txId);
            await algosdk.waitForConfirmation(algodClient, txId, 4);
            console.log("Opt-In Confirmed!");
        } catch (e) {
            console.log("Opt-In Error:", e.message);
            if (e.response && e.response.text) console.log(e.response.text);
            return;
        }

        const params2 = await algodClient.getTransactionParams().do();
        params2.fee = 2000;
        params2.flatFee = true;

        console.log("Sending Submit Data...");
        const methodObj = new algosdk.ABIMethod({
            name: "submit_data",
            args: [
                { type: "uint64" }, { type: "uint64" }, { type: "uint64" }, { type: "uint64" },
                { type: "string" }, { type: "string" }, { type: "string" }
            ],
            returns: { type: "void" }
        });

        const atc = new algosdk.AtomicTransactionComposer();
        atc.addMethodCall({
            appID: appId,
            method: methodObj,
            methodArgs: [100, 50, 41, 41, "hash1", "hash2", "college"],
            sender: account.addr,
            signer: algosdk.makeBasicAccountTransactionSigner(account),
            suggestedParams: params2
        });

        const result = await atc.execute(algodClient, 4);
        console.log("Submit Success! TXID:", result.txIDs[0]);
    } catch (e) {
        console.error("Submit Error:", e.message);
        if (e.response && e.response.text) console.error(JSON.parse(e.response.text));
    }
}
main();
