const { pxgrid, pxclient } = require('./pxgrid-setup');

client.connectToBroker().then(session =>
  client.subscribeToSessions(session, function(message) {
    console.log(message.body);
  })
);
