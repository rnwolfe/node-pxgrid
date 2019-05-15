// This file is just a testing playground for all
// the pxgrid - control / client lib functions!
// aka a total free for all!
const { pxgrid, pxclient } = require('./pxgrid-setup');

const ancCallback = function(message) {
  //console.log(message)
  const body = JSON.parse(message.body);
  console.log(body);
  console.log(
    'Endpoint ' + body.macAddress + ' has had an ' + body.status + ' ANC event'
  );
};

function uint8arrayToStringMethod(myUint8Arr) {
  return String.fromCharCode.apply(null, myUint8Arr);
}

const genericCallback = function(message) {
  //console.log("NEW MESSAGE: " + message.body);
  // must use JSON.parse to use as a JS object
  //console.log(message);
  var body = new TextDecoder('utf-8').decode(message._binaryBody);
  console.log(uint8arrayToStringMethod(message._binaryBody));
  //console.log(JSON.stringify(body))
  //const body = JSON.parse(message.body);
  //console.log(body);
};

function main() {
  /*
  pxclient.getAncPolicies().then(response => console.log(response));
  pxclient.getAncPolicyByName('QUARANTINE').then(response => console.log(response));
  pxclient.createAncPolicy('TEST', ['QUARANTINE']).then(response => console.log(response)).catch(error => console.log(error));
  pxclient.deleteAncPolicy('TEST').then(response => console.log(response));
  pxclient.applyAncToEndpointByMac('QUARANTINE', '11:00:00:00:00:01').then(response => console.log(response))
  pxclient.clearAncFromEndpointByMac('QUARANTINE', '11:00:00:00:00:01').then(response => console.log(response))
  pxclient.applyAncToEndpointByIp('QUARANTINE', '169.254.125.167').then(response => console.log(response))
  pxclient.clearAncFromEndpointByIp('QUARANTINE', '169.254.125.167').then(response => console.log(response))
  pxclient.getAncOperationStatus(id).then(response => console.log(response))

  pxclient.getSessions().then(sessions => console.log(sessions));
  pxclient.getSessionByIp('169.254.125.167').then(response => console.log(response));
  pxclient.getSessionByMac('00:0C:29:E6:F0:1B').then(response => console.log(response));
  pxclient.getUserGroups().then(data => console.log(data));
  pxclient.getUserGroupByUserName('00:0C:29:E6:F0:1B').then(response => console.log(response));

  pxclient.getProfiles().then(profiles => console.log(profiles));

  pxclient.getMdmEndpoints().then(response => console.log(response));
  pxclient.getMdmEndpointByMac('11:00:00:00:00:01').then(response => console.log(response));
  pxclient.getMdmEndpointsByOs('WINDOWS').then(response => console.log(response));
  pxclient.getMdmEndpointsByType('COMPLIANT').then(response => console.log(response));

  pxclient.getRadiusFailures().then(response => console.log(response));
  pxclient.getRadiusFailureById(1549039797873435).then(response => console.log(response));

  pxclient.getSecurityGroups().then(response => console.log(response));
  pxclient.getSecurityGroupAcls().then(response => console.log(response));
  pxclient.getEgressPolicies().then(response => console.log(response));
  pxclient.getEgressMatrices().then(response => console.log(response));


  pxclient.getSystemHealth().then(data => console.log(data));
  pxclient.getSystemPerformance().then(data => console.log(data));
  */
  pxclient.getSxpBindings().then(data => console.log(data));

  /*
  pxclient.connectToBroker()
    .then(session => {
      session.activate();
      setTimeout(() => {
        //pxclient.subscribeToEndpointAsset(session, genericCallback);
        /*
        pxclient.subscribeToAncPolicies(session, ancCallback);
        pxclient.subscribeToSessions(session, genericCallback);
        pxclient.subscribeToMdmEndpoints(session, genericCallback);
        pxclient.subscribeToRadiusFailures(session, genericCallback);
        // Nothing seems to come out of these:
        pxclient.subscribeToGroups(session, genericCallback);
        pxclient.subscribeToProfiler(session, genericCallback);
        pxclient.subscribeToSecurityGroups(session, genericCallback);
        pxclient.subscribeToSxpBindings(session, genericCallback);
        pxclient.subscribeToEndpointAsset(session, genericCallback);
      }, 1500);

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
              "assetMacAddress": "11:00:00:00:00:04",
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
  */
  //pxclient.getProfiles().then(profiles => console.log(profiles));

  /*
  setTimeout(() => {
    pxclient.applyAncToEndpointByMac('QUARANTINE', '11:00:00:00:00:01')
      .then(response => console.log(response));
  }, 3000);

  setTimeout(() => {
    pxclient.clearAncFromEndpointByMac('QUARANTINE', '11:00:00:00:00:01')
      .then(response => console.log(response));
  }, 6000);
  */
}

pxclient.connect().then(() => main());
