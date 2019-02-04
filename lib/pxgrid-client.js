const http = require('axios');
const https = require('https');
const WebSocket = require('ws');
const StompJs = require('@stomp/stompjs');

// This library does not yet support any PUBLISHING
// Fully complete for REST and Subscribe
const ANC_SERVICE = 'com.cisco.ise.config.anc';
const SESSION_SERVICE = 'com.cisco.ise.session';
const PROFILER_SERVICE = 'com.cisco.ise.config.profiler';
const MDM_SERVICE = 'com.cisco.ise.mdm';
const RADIUS_SERVICE = 'com.cisco.ise.radius';
const SYSTEM_HEALTH_SERVICE = 'com.cisco.ise.system';

// Working on, incomplete
const PUBSUB_SERVICE = 'com.cisco.ise.pubsub';

// Not started
const ENDPOINT_ASSET_SERVICE = 'com.cisco.endpoint.asset'; // This is a Context-In publish only service
const TRUSTSEC_SERVICE = 'com.cisco.ise.trustsec';
const TRUSTSEC_CONFIG_SERVICE = 'com.cisco.ise.config.trustsec';
const TRUSTSEC_SXP_SERVICE = 'com.cisco.ise.sxp';


class PxgridRestClient {
  constructor(pxgridControl) {
    this.pxgrid = pxgridControl;
    this.config = this.pxgrid.getConfig();
    this.restSessions = [];
  }

  _post(session, url, payload = {}, debug=false) {
    return session.post(url, payload)
      .then(response => {
        if (debug) {
          console.debug('URL: ' + url);
          console.debug('DATA: ' + response.data);
        }
        return response.data;
      });
  }

  _getServiceInfo(service) {
    return this.pxgrid.serviceLookup(service);
  }

  _getServiceWithSecret(service) {
    let nodeInfo = {};
    return this._getServiceInfo(service)
      .then(service => {
        nodeInfo = service;
        return nodeInfo;
      })
      .then(node => this._getAccessSecret(node.nodeName))
      .then(secret => {
        nodeInfo.secret = secret;
        return nodeInfo;
      })
  }

  _getAccessSecret(nodeName) {
    return this.pxgrid.getAccessSecret(nodeName)
      .then(response => response.secret)
      .catch(error => { throw new Error(error) });
  }

  _getRestSession(serviceName, baseUrl, nodeSecret) {
    // Check if we've already created a session for this service to prevent excessive object creation.
    if (this.restSessions[serviceName]) return this.restSessions[serviceName];

    const basicAuth = Buffer.from(this.config.client + ":" + nodeSecret).toString('base64');
    const httpsOptions = {
      cert: this.config.clientCert,
      key: this.config.clientKey,
      ca: this.config.caBundle,
      rejectUnauthorized: false
    };
    if (this.config.clientKeyPassword) httpsOptions.passphrase = this.config.clientKeyPassword;

    const session = http.create({
      baseURL: baseUrl,
      headers: {
        'Authorization': 'Basic ' + basicAuth,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      httpsAgent: new https.Agent(httpsOptions)
    });

    this.restSessions[serviceName] = session;
    return this.restSessions[serviceName];
  }

  _getRest(service) {
    return this._getServiceWithSecret(service)
      .then(service => this._getRestSession(service.name, service.properties.restBaseUrl, service.secret));
  }


  // Pubsub functions
  _getPubsubWebSocket(pubsubService) {
    const basicAuth = Buffer.from(this.config.client + ":" + pubsubService.secret).toString('base64');
    const headers = { 'Authorization': 'Basic ' + basicAuth }
    const socketOptions = {
      cert: this.config.clientCert,
      key: this.config.clientKey,
      ca: this.config.caBundle,
      rejectUnauthorized: false,
      headers: headers
    }
    if (this.config.clientKeyPassword) socketOptions.passphrase = this.config.clientKeyPassword;
    return new WebSocket(pubsubService.properties.wsUrl, socketOptions);
  }

  connectToBroker(debug=false) {
    return this._getServiceWithSecret(PUBSUB_SERVICE)
      .then(pubsub => {
        const client = new StompJs.Client({
          webSocketFactory: () => this._getPubsubWebSocket(pubsub),
          debug: str => {
            if(debug) console.log(str);
          },
          forceBinaryWSFrames: true,
          connectHeaders: { host: pubsub.nodeName },
          stompVersions: new StompJs.Versions(['1.2']),
          reconnectDelay: 30000,
          heartbeatIncoming: 4000,
          heartbeatOutgoing: 4000
        });

        client.onConnect = function (frame) {
          // Do something, all subscribes must be done is this callback
          // This is needed because this will be executed after a (re)connect
          console.log("Connected to STOMP broker!");
          console.log("FRAME: " + frame);
        };

        client.onWebSocketClose = function (frame) {
          console.log('Disconnected from STOMP broker!');
        }

        client.onStompError = function (frame) {
          // Will be invoked in case of error encountered at Broker
          // Bad login/passcode typically will cause an error
          // Complaint brokers will set `message` header with a brief message. Body may contain details.
          // Compliant brokers will terminate the connection after any error
          console.log('Broker reported error: ' + frame.headers['message']);
          console.log('Additional details: ' + frame.body);
        };

        // client must be activated with client.activate() before subscribing
        return client;
      })
      .catch(error => { throw new Error(error) });
  }

  _subscribeToTopic(stompClient, topic, messageCallback) {
    return stompClient.subscribe(topic, messageCallback);
  }


  // Session directory functions
  getSessions() {
    return this._getRest(SESSION_SERVICE)
      .then(session => this._post(session, '/getSessions'))
      .then(response => response.sessions);
  }

  getSessionByIp(ip) {
    return this._getRest(SESSION_SERVICE)
      .then(session => this._post(session, '/getSessionByIpAddress', { ipAddress: ip }))
      .then(response => response);
  }

  getSessionByMac(mac) {
    return this._getRest(SESSION_SERVICE)
      .then(session => this._post(session, '/getSessionByMacAddress', { macAddress: mac }))
      .then(response => response);
  }

  getUserGroups() {
    return this._getRest(SESSION_SERVICE)
      .then(session => this._post(session, '/getUserGroups'))
      .then(response => response.userGroups);
  }

  getUserGroupByUserName(name) {
    return this._getRest(SESSION_SERVICE)
      .then(session => this._post(session, '/getUserGroupByUserName', { userName: name }))
      .then(response => response.groups);
  }

  subscribeToSessions(stompClient, messageCallback) {
    return this._getServiceWithSecret(SESSION_SERVICE)
      .then(service => this._subscribeToTopic(stompClient, service.properties.sessionTopic, messageCallback));
  }

  subscribeToGroups(stompClient, messageCallback) {
    return this._getServiceWithSecret(SESSION_SERVICE)
      .then(service => this._subscribeToTopic(stompClient, service.properties.groupTopic, messageCallback));
  }

  // Profiler
  getProfiles() {
    return this._getRest(PROFILER_SERVICE)
      .then(session => this._post(session, '/getProfiles'))
      .then(response => response.profiles);
  }

  subscribeToProfiler(stompClient, messageCallback) {
    // This topic doesn't appear to emit any data when an endpoint changes profile,
    // or when a profile is created/deleted. Not sure if there's anything being published.
    return this._getServiceWithSecret(PROFILER_SERVICE)
    .then(service => this._subscribeToTopic(stompClient, service.properties.topic, messageCallback));
  }

  // MDM
  // I don't have MDM integrated with ISE, so unable to fully test some of these.
  getMdmEndpoints(filter = false) {
    let payload = {};
    if (filter) payload.filter = filter;
    return this._getRest(MDM_SERVICE)
      .then(session => this._post(session, '/getEndpoints', payload))
      .then(response => response.endpoints)
      .catch(error => console.error(error));
  }

  getMdmEndpointByMac(mac) {
    return this._getRest(MDM_SERVICE)
      .then(session => this._post(session, '/getEndpointByMacAddress', { macAddress: mac }))
      .then(response => response)
      .catch(error => console.error(error));
  }

  getMdmEndpointsByType(type) {
    if (!type) throw new Error('Must specify a type of NON_COMPLIANT, REGISTERED, or DISCONNECTED.');
    return this._getRest(MDM_SERVICE)
      .then(session => this._post(session, '/getEndpointsByType', { type: type }))
      .then(response => response.endpoints)
      .catch(error => console.error(error));
  }

  getMdmEndpointsByOs(osType) {
    if (!type) throw new Error('Must specify an OS of ANDROID, IOS, or WINDOWS.');
    return this._getRest(MDM_SERVICE)
      .then(session => this._post(session, '/getEndpointsByOsType', { osType: osType }))
      .then(response => response.endpoints)
      .catch(error => console.error(error));
  }

  subscribeToMdmEndpoints(stompClient, messageCallback) {
    return this._getServiceWithSecret(MDM_SERVICE)
    .then(service => this._subscribeToTopic(stompClient, service.properties.endpointTopic, messageCallback));
  }

  // Adaptive Network Control (ANC)
  getAncPolicies() {
    return this._getRest(ANC_SERVICE)
      .then(session => this._post(session, '/getPolicies'))
      .then(response => response.policies);
  }

  getAncPolicyByName(name) {
    return this._getRest(ANC_SERVICE)
      .then(session => this._post(session, '/getPolicyByName', { name: name }))
      .then(response => response);
  }

  createAncPolicy(name, actions) {
    // actions must be an array, and must only be one item in the array.
    // Acceptable values are QUARANTINE, SHUT_DOWN, PORT_BOUNCE
    if (typeof (actions) !== 'object') throw new Error("'actions' must be an object.");
    // The below errors are described well enough by upstream API response.
    //if (actions.length !== 1) throw new Error("'actions' must only have one item in the object");
    //if (actions[0] !== 'QUARANTINE' && actions[0] !== 'SHUT_DOWN' && actions[0] !== 'PORT_BOUNCE') throw new Error("'actions' must be an array with a single value of: QUARANTINE, PORT_BOUNCE, or SHUT_DOWN");

    return this._getRest(ANC_SERVICE)
      .then(session => this._post(session, '/createPolicy', { name: name, actions: actions }))
      .catch(error => { throw new Error(error.response.data.message) });
  }

  deleteAncPolicy(name) {
    return this._getRest(ANC_SERVICE)
      .then(session => this._post(session, '/deletePolicyByName', { name: name }))
      .catch(error => { throw new Error(error) });
  }

  getAncEndpoints() {
    return this._getRest(ANC_SERVICE)
      .then(session => this._post(session, '/getEndpoints'))
      .catch(error => { throw new Error(error) });
  }

  getAncEndpointByMac(mac) {
    return this._getRest(ANC_SERVICE)
      .then(session => this._post(session, '/getEndpointByMacAddress', { macAddress: mac }))
      .catch(error => { throw new Error(error) });
  }

  applyAncToEndpointByMac(policy, mac) {
    return this._getRest(ANC_SERVICE)
      .then(session => this._post(session, '/applyEndpointByMacAddress', { policyName: policy, macAddress: mac}))
      .catch(error => { throw new Error(error) });
  }

  clearAncFromEndpointByMac(policy, mac) {
    return this._getRest(ANC_SERVICE)
      .then(session => this._post(session, '/clearEndpointByMacAddress', { policyName: policy, macAddress: mac}))
      .catch(error => { throw new Error(error) });
  }

  applyAncToEndpointByIp(policy, ip) {
    return this._getRest(ANC_SERVICE)
      .then(session => this._post(session, '/applyEndpointByIpAddress', { policyName: policy, ipAddress: ip}))
      .catch(error => { throw new Error(error) });
  }

  clearAncFromEndpointByIp(policy, ip) {
    return this._getRest(ANC_SERVICE)
      .then(session => this._post(session, '/clearEndpointByIpAddress', { policyName: policy, ipAddress: ip}))
      .catch(error => { throw new Error(error) });
  }

  getAncOperationStatus(id) {
    return this._getRest(ANC_SERVICE)
      .then(session => this._post(session, '/getOperationStatus', { operationId: id}))
      .catch(error => { throw new Error(error) });
  }

  subscribeToAncPolicies(stompClient, messageCallback) {
    return this._getServiceWithSecret(ANC_SERVICE)
    .then(service => this._subscribeToTopic(stompClient, service.properties.statusTopic, messageCallback));
  }

  // RADIUS
  getRadiusFailures(startTimestamp = false) {
    let payload = {};
    if (startTimestamp) payload.startTimestamp = startTimestamp;
    return this._getRest(RADIUS_SERVICE)
      .then(session => this._post(session, '/getFailures', payload))
      .then(response => response.failures)
      .catch(error => { throw new Error(error) });
  }

  getRadiusFailureById(id) {
    return this._getRest(RADIUS_SERVICE)
      .then(session => this._post(session, '/getFailureById', { id: id }))
      .then(response => response)
      .catch(error => { throw new Error(error) });
  }

  subscribeToRadiusFailures(stompClient, messageCallback) {
    return this._getServiceWithSecret(RADIUS_SERVICE)
    .then(service => this._subscribeToTopic(stompClient, service.properties.failureTopic, messageCallback));
  }

  // System health functions
  getSystemHealth(options = { nodeName: false, startTimestamp: false }) {
    let payload = {};
    if (options.nodeName) payload.nodeName = options.nodeName;
    if (options.startTimestamp) payload.startTimestamp = options.startTimestamp;

    return this._getRest(SYSTEM_HEALTH_SERVICE)
      .then(session => this._post(session, '/getHealths', payload))
      .then(response => response.healths);
  }

  getSystemPerformance(options = { nodeName: false, startTimestamp: false }) {
    let payload = {};
    if (options.nodeName) payload.nodeName = options.nodeName;
    if (options.startTimestamp) payload.startTimestamp = options.startTimestamp;

    return this._getRest(SYSTEM_HEALTH_SERVICE)
      .then(session => this._post(session, '/getPerformances', payload))
      .then(response => response.performances);
  }
}

module.exports = PxgridRestClient;
