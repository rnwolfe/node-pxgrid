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

pxgrid.activate().then(() => {
  // The setTimeout()s are just to introduct arbitrary delays.
  setTimeout(() => {
    pxclient
      .applyAncToEndpointByMac('QUARANTINE', '11:00:00:00:00:01')
      .then(response => console.log(response));
  }, 3000);

  setTimeout(() => {
    pxclient
      .clearAncFromEndpointByMac('QUARANTINE', '11:00:00:00:00:01')
      .then(response => console.log(response));
  }, 6000);
});
