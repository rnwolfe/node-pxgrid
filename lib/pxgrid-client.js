const http = require('axios');
const https = require('https');
const WebSocket = require('ws');
const StompJs = require('@stomp/stompjs');

const SESSION_SERVICE = 'com.cisco.ise.session';
const PROFILER_SERVICE = 'com.cisco.ise.config.profiler';
const ANC_SERVICE = 'com.cisco.ise.config.anc';
const PUBSUB_SERVICE = 'com.cisco.ise.pubsub';

class PxgridRestClient {
  constructor(pxgridControl) {
    this.pxgrid = pxgridControl;
    this.config = this.pxgrid.getConfig();
    this.restSessions = [];
  }

  _post(session, url, payload, debug=false) {
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
      .then(session => this._post(session, '/getSessions', {}))
      .then(response => response.sessions);
  }

  subscribeToSessions(stompClient, messageCallback) {
    return this._getServiceWithSecret(SESSION_SERVICE)
      .then(service => this._subscribeToTopic(stompClient, service.properties.sessionTopic, messageCallback));
  }

  subscribeToGroups(stompClient, messageCallback) {
    return this._getServiceWithSecret(SESSION_SERVICE)
      .then(service => this._subscribeToTopic(stompClient, service.properties.groupTopic, messageCallback));
  }

  // Profiler functions
  getProfiles() {
    return this._getRest(PROFILER_SERVICE)
      .then(session => this._post(session, '/getProfiles', {}, true))
      .then(response => response.profiles);
  }


  // ANC Policies
  getAncPolicies() {
    return this._getRest(ANC_SERVICE)
      .then(session => this._post(session, '/getPolicies', {}))
      .then(response => response.policies);
  }

  subscribeToAncPolicies(stompClient, messageCallback) {
    return this._getServiceWithSecret(ANC_SERVICE)
    .then(service => this._subscribeToTopic(stompClient, service.properties.statusTopic, messageCallback));
  }

}

module.exports = PxgridRestClient;
