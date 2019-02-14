const fs = require('fs');

certs = [];
certs.certPath = '../../pxgrid-rest-ws/python/certs/';
certs.clientCert = fs.readFileSync(certs.certPath + 'publiccert.cer');
certs.clientKey = fs.readFileSync(certs.certPath + 'key.pem');
certs.caBundle = fs.readFileSync(certs.certPath + 'ise24.demo.local_10.1.100.23.cer');

module.exports = certs;