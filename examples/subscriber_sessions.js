const { pxgrid, pxclient } = require('./pxgrid-setup');

pxclient.connectToBroker().then(session =>
  pxclient.subscribeToSessions(session, function (message) {
    console.log(message.body);
  })
);
