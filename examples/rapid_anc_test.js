const fs = require('fs');
const certs = require('./certs.js');

const Pxgrid = require('../');

const pxgridControlOptions = {
  host: 'dnaise.ironbowlab.com',
  client: 'my-node-app',
  clientCert: certs.clientCert,
  clientKey: certs.clientKey,
  caBundle: certs.caBundle,
  clientKeyPassword: 'Pxgrid123'
};
const pxgrid = new Pxgrid.Control(pxgridControlOptions);
const pxclient = new Pxgrid.Client(pxgrid);

async function main() {
  max = process.argv[2] || 6;
  for (let i = 0; i < max; i++) {
    if (i % 2 === 0) {
      console.log(i, Date.now() + ': applying policy.');
      await pxclient.applyAncToEndpointByMac('QUARANTINE', '11:00:00:00:00:01');
    } else {
      console.log(i, Date.now() + ': clearing policy.');
      await pxclient.clearAncFromEndpointByMac(
        'QUARANTINE',
        '11:00:00:00:00:01'
      );
    }
  }
}

pxgrid.activate().then(() => main());
