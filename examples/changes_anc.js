const fs = require('fs');
const certs = require('./certs.js');

const PxgridControl = require('../lib/pxgrid-control');
const PxgridRestClient = require('../lib/pxgrid-client');

const pxgrid = new PxgridControl('ise24.demo.local', 'pxpython', certs.clientCert, certs.clientKey, certs.caBundle);
const pxclient = new PxgridRestClient(pxgrid);

function main() {
  setTimeout(() => {
    pxclient.applyAncToEndpointByMac('QUARANTINE', '11:00:00:00:00:01')
      .then(response => console.log(response));
  }, 3000);

  setTimeout(() => {
    pxclient.clearAncFromEndpointByMac('QUARANTINE', '11:00:00:00:00:01')
      .then(response => console.log(response));
  }, 6000);
}

pxgrid.isActivated()
  .then(() => main());

