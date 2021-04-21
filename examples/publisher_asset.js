const { pxgrid, pxclient } = require('./pxgrid-setup');

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
  assetDeviceType: "My is angry",
  assetIpAddress: '1.2.3.4',
  assetCustomAttributes: [
    {
      value: 'SuperDevice',
      key: 'MyCustomAttr1'
    },
    {
      value: 'Pushed via PxGrid',
      key: 'MyCustomAttr2'
    }
  ],
  assetConnectedLinks: []
};

pxclient.connect().then(session =>
  pxclient.createEndpointAssetPublisher().then(() => {
    console.log('PUBLISHER ESTABLISHED');
    pxclient.publishEndpointAssetUpdate(session, body);
  })
);
