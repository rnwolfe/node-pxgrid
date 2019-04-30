const fs = require('fs');

certs = [];
certs.certPath = './certs/';
certs.clientCert = fs.readFileSync(certs.certPath + 'my-node-app.cer');
certs.clientKey = fs.readFileSync(certs.certPath + 'my-node-app.key');
certs.caBundle = fs.readFileSync(certs.certPath + 'ise-chain.cer');

module.exports = certs;