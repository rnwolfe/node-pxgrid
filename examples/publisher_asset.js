const certs = require('./certs.js');

const Pxgrid = require('../');

const pxgridControlOptions = {
  host: 'dnaise.ironbowlab.com',
  client: 'my-node-app',
  clientCert: certs.clientCert,
  clientKey: certs.clientKey,
  caBundle: certs.caBundle,
  clientKeyPassword: 'Pxgrid123'
};
const pxgrid = new Pxgrid.Control(pxgridControlOptions);
const pxclient = new Pxgrid.Client(pxgrid);

pxgrid.activate().then(() => {
  pxclient.connectToBroker().then(session => {
    pxclient.createEndpointAssetPublisher().then(() => {
      console.log('PUBLISHER ESTABLISHED');
      const body = {
        assetId: '260',
        assetName: 'Abjergaryn - 47',
        assetHwRevision: '5.6',
        assetProtocol: 'CIP',
        assetVendor: 'Cisco Systems',
        assetSwRevision: '4.6',
        assetProductId: 'IE2000',
        assetSerialNumber: '1212121213243',
        assetMacAddress: '11:00:00:00:00:01',
        assetDeviceType: "Ryan Wolfe's Special Device",
        assetIpAddress: '1.2.3.4',
        assetCustomAttributes: [
          {
            value: 'SuperDevice',
            key: 'WolfeAttr'
          }
        ],
        assetConnectedLinks: []
      };

      pxclient.publishEndpointAssetUpdate(session, body);
    });
  });
});
