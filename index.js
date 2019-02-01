const fs = require('fs');
const PxgridControl = require('./lib/pxgrid-control');
const PxgridRestClient = require('./lib/pxgrid-client');

const certPath = '../pxgrid-rest-ws/python/certs/';
const clientCert = fs.readFileSync(certPath + 'publiccert.cer');
const clientKey = fs.readFileSync(certPath + 'key.pem');
const caBundle = fs.readFileSync(certPath + 'ise24.demo.local_10.1.100.23.cer');

const pxgrid = new PxgridControl('ise24.demo.local', 'pxpython', clientCert, clientKey, caBundle);
const client = new PxgridRestClient(pxgrid);

function main() {
  console.log('main is ready');
  client.getProfiles()
    .then(profiles => console.log('PROFILES: ' + profiles));
}

pxgrid.isActivated()
  .then(() => main());