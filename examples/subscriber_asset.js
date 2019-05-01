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

const genericCallback = function(message) {
  console.log(message.body);
};

pxgrid.activate().then(() => {
  pxclient
    .connectToBroker()
    .then(session =>
      pxclient.subscribeToEndpointAsset(session, genericCallback)
    );
});
