const algosdk = require('algosdk');
try {
  const encoded = algosdk.ABIType.from("string").encode("hello");
  console.log(encoded);
} catch (e) {
  console.error(e);
}
