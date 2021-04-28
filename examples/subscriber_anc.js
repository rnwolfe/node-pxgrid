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

function connect() {
  retryInterval = 5 * 1000;
  pxclient
    .connect({ debug: true })
    .then(session => pxclient.subscribeToAncPolicies(session, ancCallback))
    .catch(error => {
      if (error.toString().includes('None of the provided hosts responded')) {
        console.log(error);
        console.log(
          `${Date(
            Date.now()
          ).toString()}: Failed to connect to nodes, trying again in ${retryInterval /
            1000} seconds`
        );
        setTimeout(connect, retryInterval);
      }
    });
}

connect();
