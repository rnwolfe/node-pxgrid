const { pxgrid, pxclient } = require('./pxgrid-setup');

const genericCallback = function (message) {
  console.log(message.body);
};

pxclient
  .connect({ debug: true })
  .then(session => pxclient.subscribeToAllTopics(session, genericCallback));
