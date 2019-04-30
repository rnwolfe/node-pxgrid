const certs = require('./certs.js');

const PxgridControl = require('../lib/pxgrid-control');
const PxgridRestClient = require('../lib/pxgrid-client');

const pxgridControlOptions = {
  host: 'dnaise.ironbowlab.com',
  client: 'my-node-app',
  clientCert: certs.clientCert,
  clientKey: certs.clientKey,
  caBundle: certs.caBundle,
  clientKeyPassword: 'Pxgrid123'
}
const pxgrid = new PxgridControl(pxgridControlOptions);
const pxclient = new PxgridRestClient(pxgrid);

const genericCallback = function (message) {
  console.log(message.body);
}

function main() {
  pxclient.connectToBroker()
    .then(session => {
      pxclient.subscribeToEndpointAsset(session, genericCallback);
    });
}

pxgrid.isActivated()
  .then(() => main());

