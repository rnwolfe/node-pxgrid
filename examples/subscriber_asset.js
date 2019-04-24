const certs = require('./certs.js');

const PxgridControl = require('../lib/pxgrid-control');
const PxgridRestClient = require('../lib/pxgrid-client');

const pxgridControlOptions = {
  host: 'ise24.demo.local',
  client: 'pxpython',
  clientCert: certs.clientCert,
  clientKey: certs.clientKey,
  caBundle: certs.caBundle,
  clientKeyPassword = false,
  secret = '',
  port = '8910'
}
const pxgrid = new PxgridControl(pxgridControlOptions);
const pxclient = new PxgridRestClient(pxgrid);

function uint8arrayToStringMethod(myUint8Arr){
   return String.fromCharCode.apply(null, myUint8Arr);
}

const genericCallback = function (message) {
  var body = new TextDecoder("utf-8").decode(message._binaryBody);
  console.log(uint8arrayToStringMethod(message._binaryBody));
}

function main() {
  pxclient.connectToBroker()
    .then(session => {
      session.activate();
      setTimeout(() => {
        pxclient.subscribeToEndpointAsset(session, genericCallback);
      }, 3000);

    });
}

pxgrid.isActivated()
  .then(() => main());

