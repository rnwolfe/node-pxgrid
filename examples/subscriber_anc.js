const certs = require('./certs.js');

const Pxgrid = require('../');

const pxgridControlOptions = {
  host: 'dnaise.ironbowlab.com',
  client: 'my-node-app',
  clientCert: certs.clientCert,
  clientKey: certs.clientKey,
  caBundle: certs.caBundle,
  clientKeyPassword: 'Pxgrid123'
}
const pxgrid = new Pxgrid.Control(pxgridControlOptions);
const pxclient = new Pxgrid.Client(pxgrid);

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

