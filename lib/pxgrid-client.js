const http = require('axios');
const https = require('https');
const WebSocket = require('ws');
const StompJs = require('@stomp/stompjs');

class PxgridRestClient {
  constructor(pxgridControl) {
    this.pxgrid = pxgridControl;
    this.config = this.pxgrid.getConfig();
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

  _getRestSession(baseUrl, nodeSecret) {
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

    return session;
  }

  _getAccessSecret(nodeName) {
    return this.pxgrid.getAccessSecret(nodeName)
      .then(response => response.secret)
      .catch(error => { throw new Error(error) });
  }

  // Pubsub functions
  _getPubsubNode() {
    return this.pxgrid.serviceLookup('com.cisco.ise.pubsub')
      .then(response =>  response.services[0]);
  }

  _getPubsubService() {
    let nodeInfo = {};
    return this._getPubsubNode()
      .then(profilerService => {
        nodeInfo = profilerService;
        return nodeInfo;
      })
      .then(node => this._getAccessSecret(node.nodeName))
      .then(secret => {
        nodeInfo.secret = secret;
        return nodeInfo;
      })
  }

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

  connectToBroker() {
    return this._getPubsubService()
      .then(pubsub => {
        const client = new StompJs.Client({
          webSocketFactory: () => this._getPubsubWebSocket(pubsub),
          debug: function (str) {
            console.log(str);
          },
          forceBinaryWSFrames: true,
          connectHeaders: { host: pubsub.nodeName },
          stompVersions: new StompJs.Versions(['1.2']),
          reconnectDelay: 30000,
          //heartbeatIncoming: 4000,
          //heartbeatOutgoing: 4000
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


  _connectPubsub() {

  }

  _subscribeToTopic(stompClient, topic, messageCallback) {
    return stompClient.subscribe(topic, messageCallback);
  }

  // Profiler functions
  _getProfilerNode() {
    return this.pxgrid.serviceLookup('com.cisco.ise.config.profiler')
      .then(response => {
        const service = response.services[0];
        return {
          nodeName: service.nodeName,
          restBaseUrl: service.properties.restBaseUrl
        }
      });
  }

  _getProfilerService() {
    let nodeInfo = {};
    return this._getProfilerNode()
      .then(profilerService => {
        nodeInfo = profilerService;
        return nodeInfo;
      })
      .then(node => this._getAccessSecret(node.nodeName))
      .then(secret => {
        nodeInfo.secret = secret;
        return nodeInfo;
      })
  }

  getProfiles() {
    return this._getProfilerService()
      .then(service => {
        const session = this._getRestSession(service.restBaseUrl, service.secret);
        return this._post(session, '/getProfiles', {}, true)
          .then(response => response.profiles);
      });
  }

  // ANC Policies
  _getAncNode() {
    return this.pxgrid.serviceLookup('com.cisco.ise.config.anc')
      .then(response => {
        const service = response.services[0];
        return {
          nodeName: service.nodeName,
          restBaseUrl: service.properties.restBaseUrl
        }
      });
  }

  _getAncService() {
    let nodeInfo = {};
    return this._getAncNode()
      .then(ancService => {
        nodeInfo = ancService;
        console.log(JSON.stringify(ancService));
        return nodeInfo;
      })
      .then(node => this._getAccessSecret(node.nodeName))
      .then(secret => {
        nodeInfo.secret = secret;
        return nodeInfo;
      })
  }

  getAncPolicies() {
    return this._getAncService()
      .then(service => {
        const session = this._getRestSession(service.restBaseUrl, service.secret);
        return this._post(session, '/getPolicies', {}, true)
          .then(response => response.policies);
      });
  }

  subscribeToAncPolicies(stompClient, messageCallback) {
    return this._subscribeToTopic(stompClient, '/topic/com.cisco.ise.config.anc.status', messageCallback);
  }

}

module.exports = PxgridRestClient;
