const fs = require('fs');

certs = [];
certs.certPath = './certs/';
certs.clientCert = fs.readFileSync(certs.certPath + 'node-pxgrid-test.cer');
certs.clientKey = fs.readFileSync(certs.certPath + 'node-pxgrid-test.key');
certs.caBundle = fs.readFileSync(certs.certPath + 'dnaise.ironbowlab.com.cer');

module.exports = certs;
