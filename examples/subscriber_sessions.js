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

const control = new Pxgrid.Control(pxgridControlOptions);
const client = new Pxgrid.Client(control);

control.activate().then(() => {
  client.connectToBroker().then(session =>
    client.subscribeToSessions(session, function(message) {
      console.log(message.body);
    })
  );
});
