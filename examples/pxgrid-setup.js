const certs = require('./certs.js');

const Pxgrid = require('../');

const pxgridControlOptions = {
  hosts: ['dnaise.ironbowlab.com'],
  client: 'node-pxgrid-test',
  clientCert: certs.clientCert,
  clientKey: certs.clientKey,
  caBundle: certs.caBundle,
  clientKeyPassword: 'Cisco123'
};

const pxclient = new Pxgrid.Client(pxgridControlOptions);

module.exports.pxclient = pxclient;
