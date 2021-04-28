const { pxgrid, pxclient } = require('./pxgrid-setup');

pxclient.connect({ debug: true }).then(session =>
  pxclient.subscribeToSessions(session, function(message) {
    console.log(message.body);
  })
);
