const fs = require('fs');
const certs = require('./certs.js');

const PxgridControl = require('../lib/pxgrid-control');
const PxgridRestClient = require('../lib/pxgrid-client');

const pxgrid = new PxgridControl('ise24.demo.local', 'pxpython', certs.clientCert, certs.clientKey, certs.caBundle);
const pxclient = new PxgridRestClient(pxgrid);

const ancCallback = function (message) {
  const body = JSON.parse(message.body);
  console.log(body);
  console.log("Endpoint " + body.macAddress + " has had an " + body.status + " ANC event");
}

function main() {
  pxclient.connectToBroker()
    .then(session => {
      session.activate();
      setTimeout(() => {
        pxclient.subscribeToAncPolicies(session, ancCallback);
      }, 1500);
    });
}

pxgrid.isActivated()
  .then(() => main());

