const { pxgrid, pxclient } = require('./pxgrid-setup');

const genericCallback = function(message) {
  console.log(`${Date.now()}: ${JSON.stringify(message.body)}`);
};

pxgrid.activate().then(() => {
  pxclient
    .connectToBroker()
    .then(session =>
      pxclient.subscribeToCustom(
        session,
        'blah.blah.blah',
        'customTopic',
        genericCallback
      )
    );
});
