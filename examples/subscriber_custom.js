const { pxgrid, pxclient } = require('./pxgrid-setup');

const genericCallback = function(message) {
  console.log(`${Date.now()}: ${JSON.stringify(message.body)}`);
};

pxclient
  .connect()
  .then(session =>
    pxclient.subscribeToCustom(
      session,
      'my.service.name',
      'myTopic',
      genericCallback
    )
  );
