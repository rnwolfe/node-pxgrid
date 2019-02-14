const certs = require('./certs.js');

const PxgridControl = require('../lib/pxgrid-control');
const PxgridRestClient = require('../lib/pxgrid-client');

const control = new PxgridControl('ise24.demo.local', 'pxpython', certs.clientCert, certs.clientKey, certs.caBundle);
const pxclient = new PxgridRestClient(control);

function main() {
  pxclient.connectToBroker()
    .then(session => {
      session.activate();
      setTimeout(() => {
        pxclient.createEndpointAssetPublisher()
          .then(() => {
            console.log('PUBLISHER ESTABLISHED');
            const body = {
              "assetId": "260",
              "assetName": "Abjergaryn - 47",
              "assetHwRevision": "5.6",
              "assetProtocol": "CIP",
              "assetVendor": "Cisco Systems",
              "assetSwRevision": "4.6",
              "assetProductId": "IE2000",
              "assetSerialNumber": "1212121213243",
              "assetMacAddress": "00:0C:29:E6:F0:1B",
              "assetDeviceType": "Ryan Wolfe's Special Device",
              "assetIpAddress": "1.2.3.4",
              "assetCustomAttributes": [
                {
                  "value": "SuperDevice",
                  "key": "WolfeAttr"
                }
              ],
              "assetConnectedLinks": []
            };

            pxclient.publishEndpointAssetUpdate(session, body)
          });
      }, 3000);
    });
}

control.isActivated()
  .then(() => main());

