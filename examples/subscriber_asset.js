const certs = require('./certs.js');

const PxgridControl = require('../lib/pxgrid-control');
const PxgridRestClient = require('../lib/pxgrid-client');

const pxgrid = new PxgridControl('ise24.demo.local', 'pxpython', certs.clientCert, certs.clientKey, certs.caBundle);
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

