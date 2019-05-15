const { pxgrid, pxclient } = require('./pxgrid-setup');

const genericCallback = function(message) {
  console.log(message.body);
};

pxclient
  .connect()
  .then(session => pxclient.subscribeToEndpointAsset(session, genericCallback));
