const { pxgrid, pxclient } = require('./pxgrid-setup');

const ancCallback = function(message) {
  const body = message.body;
  console.log(
    `${Date.now()}: Endpoint ${body.macAddress} has had an ${
      body.status
    } ANC event.`
  );
};

pxclient
  .connect()
  .then(session => pxclient.subscribeToAncPolicies(session, ancCallback));
