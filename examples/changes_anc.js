const fs = require('fs');
const certs = require('./certs.js');

const PxgridControl = require('../lib/pxgrid-control');
const PxgridRestClient = require('../lib/pxgrid-client');

const pxgridControlOptions = {
  host: 'ise24.demo.local',
  client: 'pxpython',
  clientCert: certs.clientCert,
  clientKey: certs.clientKey,
  caBundle: certs.caBundle,
  clientKeyPassword = false,
  secret = '',
  port = '8910'
}
const pxgrid = new PxgridControl(pxgridControlOptions);
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

