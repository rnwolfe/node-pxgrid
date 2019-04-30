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

const ancCallback = function (message) {
  const body = message.body;
  //console.log(body);
  console.log(Date.now() + ": Endpoint " + body.macAddress + " has had an " + body.status + " ANC event");
}

function main() {
  pxclient.connectToBroker()
    .then(session => pxclient.subscribeToAncPolicies(session, ancCallback));
}

pxgrid.activate()
  .then(() => main());

