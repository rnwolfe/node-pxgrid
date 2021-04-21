const { pxgrid, pxclient } = require('./pxgrid-setup');

const ancCallback = function(message) {
  const body = message.body;
  console.log(
    `${Date.now()}: Endpoint ${body.macAddress} has had an ${
      body.status
    } ANC event.`
  );

  pxclient
    .getAncEndpointByMac(body.macAddress)
    .then(endpoint => console.log('Endpoint ANC Policies:', endpoint, '\n\n'));
};

pxclient
  .connect()
  .then(session => pxclient.subscribeToAncPolicies(session, ancCallback));
