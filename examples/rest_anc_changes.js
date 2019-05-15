const { pxgrid, pxclient } = require('./pxgrid-setup');

pxclient.connect().then(() => {
  // The setTimeout()s are just to introduct arbitrary delays.
  setTimeout(() => {
    pxclient
      .applyAncToEndpointByMac('QUARANTINE', '11:00:00:00:00:01')
      .then(response => console.log(response));
  }, 3000);

  setTimeout(() => {
    pxclient
      .clearAncFromEndpointByMac('QUARANTINE', '11:00:00:00:00:01')
      .then(response => console.log(response));
  }, 6000);
});
