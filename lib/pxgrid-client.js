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
const TRUSTSEC_SERVICE = 'com.cisco.ise.trustsec';
const TRUSTSEC_CONFIG_SERVICE = 'com.cisco.ise.config.trustsec';
const TRUSTSEC_SXP_SERVICE = 'com.cisco.ise.sxp';

// Working on, incomplete
const PUBSUB_SERVICE = 'com.cisco.ise.pubsub';

// Not started
const ENDPOINT_ASSET_SERVICE = 'com.cisco.endpoint.asset'; // This is a Context-In publish only service

/**
 * @class PxgridRestClient
 *
 * @description Series of functions that allow easy interaction with Cisco PxGrid 2.0 protocol implementation (typically with a Cisco ISE PxGrid Controller).
 * @description PxGrid 2.0 makes use of REST API for push/pull options, and Web Sockets for messaging-style connections.
 * @description The web sockets use a STOMP-based messaging framework.
 * @constructor
 * @param {Object.<PxgridControl>} pxGridControl
 *
 * @see {@link PxgridControl}
 * @see {@link https://github.com/cisco-pxgrid/pxgrid-rest-ws/wiki/ Cisco PxGrid 2.0 GitHub Wiki} for more information on the Cisco PxGrid 2.0 implementation.
 *
 * @example <caption>PxgridClient instance setup excluded.</caption>
 * const PxgridRestClient = require('pxgrid-client');
 *
 * const pxgrid = new PxgridControl(pxgridControlOptions);
 * const pxclient = new PxgridRestClient(pxgridControlObject);
 *
 * pxgrid.isActivated()
 *   .then(() => {
 *     pxclient.getProfiles()
 *        .then(profiles => console.log(profiles));
 *
 *     pxclient.applyAncToEndpointByMac('QUARANTINE', '11:00:00:00:00:01')
 *       .then(response => console.log(response));
 *   });
 *
 * @example <caption>Example including the PxgridClient instance setup.</caption>
 * const fs = require('fs');
 * const PxgridControl = require('../lib/pxgrid-control');
 * const PxgridRestClient = require('../lib/pxgrid-client');
 *
 * certs = [];
 * certs.certPath = './certs/';
 * certs.clientCert = fs.readFileSync(certs.certPath + 'publiccert.cer');
 * certs.clientKey = fs.readFileSync(certs.certPath + 'key.pem');
 * certs.caBundle = fs.readFileSync(certs.certPath + 'caBundle.cer');
 *
 * const pxgridControlOptions = {
 *   host: 'my-ise-server.domain.com',
 *   client: 'node-pxgrid',
 *   clientCert: certs.clientCert,
 *   clientKey: certs.clientKey,
 *   caBundle: certs.caBundle,
 *   clientKeyPassword = false,
 *   secret = '',
 *   port = '8910'
 * }
 *
 * const pxgrid = new PxgridControl(pxgridControlOptions);
 * const pxclient = new PxgridRestClient(pxgridControlObject);
 *
 * pxgrid.isActivated()
 *   .then(() => {
 *     pxclient.getProfiles()
 *        .then(profiles => console.log(profiles));
 *
 *     pxclient.applyAncToEndpointByMac('QUARANTINE', '11:00:00:00:00:01')
 *       .then(response => console.log(response));
 *   });
 *
 */

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
      .catch(error => console.error(error));
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

  _getTopicSubscriber(stompClient, topic, messageCallback) {
    return stompClient.subscribe(topic, messageCallback);
  }


  // Session directory functions
  /**
   * Get all active sessions.
   * @function getSessions
   * @memberof PxgridRestClient
   * @returns {Promise} An array of session objects.
   */
  getSessions() {
    return this._getRest(SESSION_SERVICE)
      .then(session => this._post(session, '/getSessions'))
      .then(response => response.sessions);
  }

  /**
   * Get session information for a given IP address.
   * @function getSessionByIp
   * @memberof PxgridRestClient
   * @param {string} ip IP address to lookup session for.
   * @returns {Promise} A session object.
   */
  getSessionByIp(ip) {
    return this._getRest(SESSION_SERVICE)
      .then(session => this._post(session, '/getSessionByIpAddress', { ipAddress: ip }))
      .then(response => response);
  }

  /**
   * Get session information for a given MAC address.
   * @function getSessionByMac
   * @memberof PxgridRestClient
   * @param {string} mac MAC address to lookup session for.
   * @returns {Promise} A session object.
   */
  getSessionByMac(mac) {
    return this._getRest(SESSION_SERVICE)
      .then(session => this._post(session, '/getSessionByMacAddress', { macAddress: mac }))
      .then(response => response);
  }

  /**
   * Gets all user groups.
   * @function getUserGroups
   * @memberof PxgridRestClient
   * @returns {Promise} An array of group objects.
   */
  getUserGroups() {
    return this._getRest(SESSION_SERVICE)
      .then(session => this._post(session, '/getUserGroups'))
      .then(response => response.userGroups);
  }

  /**
   * Gets all groups a given username is a member of.
   * @function getUserGroupByUserName
   * @memberof PxgridRestClient
   * @param {string} name
   * @returns An array of group objects.
   */
  getUserGroupByUserName(name) {
    return this._getRest(SESSION_SERVICE)
      .then(session => this._post(session, '/getUserGroupByUserName', { userName: name }))
      .then(response => response.groups);
  }

  subscribeToSessions(stompClient, messageCallback) {
    return this._getServiceWithSecret(SESSION_SERVICE)
      .then(service => this._getTopicSubscriber(stompClient, service.properties.sessionTopic, messageCallback));
  }

  subscribeToGroups(stompClient, messageCallback) {
    return this._getServiceWithSecret(SESSION_SERVICE)
      .then(service => this._getTopicSubscriber(stompClient, service.properties.groupTopic, messageCallback));
  }

  // Profiler
  /**
   * @function getProfiles
   * @memberof PxgridRestClient
   * @returns {Promise} An array of endpoint profile objects.
   */
  getProfiles() {
    return this._getRest(PROFILER_SERVICE)
      .then(session => this._post(session, '/getProfiles'))
      .then(response => response.profiles);
  }

  subscribeToProfiler(stompClient, messageCallback) {
    // This topic doesn't appear to emit any data when an endpoint changes profile,
    // or when a profile is created/deleted. Not sure if there's anything being published.
    return this._getServiceWithSecret(PROFILER_SERVICE)
    .then(service => this._getTopicSubscriber(stompClient, service.properties.topic, messageCallback));
  }

  // MDM
  // I don't have MDM integrated with ISE, so unable to fully test some of these.
  /**
   * @function getMdmEndpoints
   * @memberof PxgridRestClient
   * @param {boolean} [filter=false]
   * @see {@link https://github.com/cisco-pxgrid/pxgrid-rest-ws/wiki/MDM#endpoint-object PxGrid MDM Documentation} for endpoint object used for filter.
   * @returns {Promise} An array of MDM endpoint objects.
   */
  getMdmEndpoints(filter = false) {
    let payload = {};
    if (filter) payload.filter = filter;
    return this._getRest(MDM_SERVICE)
      .then(session => this._post(session, '/getEndpoints', payload))
      .then(response => response.endpoints)
      .catch(error => console.error(error));
  }

  /**
   * @function getMdmEndpointByMac
   * @memberof PxgridRestClient
   * @param {string} mac MAC address of MDM client to retrieve.
   * @returns {Promise} An MDM endpoint object.
   */
  getMdmEndpointByMac(mac) {
    return this._getRest(MDM_SERVICE)
      .then(session => this._post(session, '/getEndpointByMacAddress', { macAddress: mac }))
      .then(response => response)
      .catch(error => console.error(error));
  }

  /**
   * @function getMdmEndpointsByType
   * @memberof PxgridRestClient
   * @param {string} type Value must be 'NON_COMPLIANT', 'REGISTERED', or 'DISCONNECTED'
   * @returns {Promise} An array of MDM endpoint objects.
   */
  getMdmEndpointsByType(type) {
    if (!type) throw new Error('Must specify a type of NON_COMPLIANT, REGISTERED, or DISCONNECTED.');
    return this._getRest(MDM_SERVICE)
      .then(session => this._post(session, '/getEndpointsByType', { type: type }))
      .then(response => response.endpoints)
      .catch(error => console.error(error));
  }

  /**
   * @function getMdmEndpointsByOs
   * @memberof PxgridRestClient
   * @param {string} osType Value must be 'ANDROID', 'IOS', or 'WINDOWS'
   * @returns {Promise} An MDM endpoint object.
   */
  getMdmEndpointsByOs(osType) {
    if (!type) throw new Error('Must specify an OS of ANDROID, IOS, or WINDOWS.');
    return this._getRest(MDM_SERVICE)
      .then(session => this._post(session, '/getEndpointsByOsType', { osType: osType }))
      .then(response => response.endpoints)
      .catch(error => console.error(error));
  }

  subscribeToMdmEndpoints(stompClient, messageCallback) {
    return this._getServiceWithSecret(MDM_SERVICE)
    .then(service => this._getTopicSubscriber(stompClient, service.properties.endpointTopic, messageCallback));
  }

  // Adaptive Network Control (ANC)
  /**
   * @function getAncPolicies
   * @memberof PxgridRestClient
   * @returns {Promise} An array of ANC policy objects.
   */
  getAncPolicies() {
    return this._getRest(ANC_SERVICE)
      .then(session => this._post(session, '/getPolicies'))
      .then(response => response.policies);
  }

  /**
   * @function getAncPolicyByName
   * @memberof PxgridRestClient
   * @param {string} name Name of an existing ANC policy.
   * @returns {Promise} An ANC policy object.
   */
  getAncPolicyByName(name) {
    return this._getRest(ANC_SERVICE)
      .then(session => this._post(session, '/getPolicyByName', { name: name }))
      .then(response => response);
  }

  /**
   * Create a new ANC policy.
   * @function createAncPolicy
   * @memberof PxgridRestClient
   * @param {string} name The name of the new ANC policy.
   * @param {Object} actions Actions must be an array, and there must only be one item in the array. Acceptable values are 'QUARANTINE', 'SHUT_DOWN', 'PORT_BOUNCE'.
   * @returns {Promise} An ANC policy object.
   */
  createAncPolicy(name, actions) {
    if (typeof (actions) !== 'object') throw new Error("'actions' must be an object.");
    return this._getRest(ANC_SERVICE)
      .then(session => this._post(session, '/createPolicy', { name: name, actions: actions }))
      .catch(error => { throw new Error(error.response.data.message) });
  }

  /**
   * Deletes an ANC policy.
   * @function deleteAncPolicy
   * @memberof PxgridRestClient
   * @param {string} name The name of the ANC policy to be deleted.
   * @returns {Promise} empty
   */
  deleteAncPolicy(name) {
    return this._getRest(ANC_SERVICE)
      .then(session => this._post(session, '/deletePolicyByName', { name: name }))
      .catch(error => { throw new Error(error) });
  }

  /**
   * Get all endpoints assigned an ANC policy.
   * @function getAncEndpoints
   * @memberof PxgridRestClient
   * @returns {Promise} An array of endpoint objects.
   */
  getAncEndpoints() {
    return this._getRest(ANC_SERVICE)
      .then(session => this._post(session, '/getEndpoints'))
      .catch(error => { throw new Error(error) });
  }

  /**
   * Get ANC policy for MAC address.
   * @memberof PxgridRestClient
   * @param {string} mac
   * @returns {Promise} An ANC endpoint object.
   */
  getAncEndpointByMac(mac) {
    return this._getRest(ANC_SERVICE)
      .then(session => this._post(session, '/getEndpointByMacAddress', { macAddress: mac }))
      .catch(error => { throw new Error(error) });
  }

  /**
   * Apply an ANC policy to an endpoint by MAC address.
   * @function applyAncToEndpointByMac
   * @memberof PxgridRestClient
   * @param {string} policy The name of the ANC policy to apply.
   * @param {string} mac The MAC address to apply the policy to.
   * @returns A status object.
   */
  applyAncToEndpointByMac(policy, mac) {
    return this._getRest(ANC_SERVICE)
      .then(session => this._post(session, '/applyEndpointByMacAddress', { policyName: policy, macAddress: mac}))
      .catch(error => { throw new Error(error) });
  }

  /**
   * Clears an ANC policy from an endpoint by MAC address.
   * @function clearAncFromEndpointByMac
   * @memberof PxgridRestClient
   * @param {string} policy The name of the ANC policy to clear.
   * @param {string} mac The MAC address to clear the policy from.
   * @returns A status object.
   */
  clearAncFromEndpointByMac(policy, mac) {
    return this._getRest(ANC_SERVICE)
      .then(session => this._post(session, '/clearEndpointByMacAddress', { policyName: policy, macAddress: mac}))
      .catch(error => { throw new Error(error) });
  }

  /**
   * Apply an ANC policy to an endpoint by IP address.
   * @function applyAncToEndpointByIp
   * @memberof PxgridRestClient
   * @param {string} policy The name of the ANC policy to apply.
   * @param {string} ip The IP address to apply the policy to.
   * @returns {Promise} A status object.
   */
  applyAncToEndpointByIp(policy, ip) {
    return this._getRest(ANC_SERVICE)
      .then(session => this._post(session, '/applyEndpointByIpAddress', { policyName: policy, ipAddress: ip}))
      .catch(error => { throw new Error(error) });
  }

  /**
   * Clears an ANC policy from an endpoint by IP address.
   * @function clearAncFromEndpointByIp
   * @memberof PxgridRestClient
   * @param {string} policy The name of the ANC policy to clear.
   * @param {string} ip The IP address to clear the policy from.
   * @returns A status object.
   */
  clearAncFromEndpointByIp(policy, ip) {
    return this._getRest(ANC_SERVICE)
      .then(session => this._post(session, '/clearEndpointByIpAddress', { policyName: policy, ipAddress: ip}))
      .catch(error => { throw new Error(error) });
  }

  /**
   * The status of an ANC operation.
   * If operation does not exist, HTTP status "204 No content" will be returned.
   * @function getAncOperationStatus
   * @memberof PxgridRestClient
   * @param {string} id An operation ID.
   * @returns {Promise} A status object.
   */
  getAncOperationStatus(id) {
    return this._getRest(ANC_SERVICE)
      .then(session => this._post(session, '/getOperationStatus', { operationId: id}))
      .catch(error => { throw new Error(error) });
  }

  subscribeToAncPolicies(stompClient, messageCallback) {
    return this._getServiceWithSecret(ANC_SERVICE)
    .then(service => this._getTopicSubscriber(stompClient, service.properties.statusTopic, messageCallback));
  }

  // RADIUS
  /**
   * Get all RADIUS failures.
   * @function getRadiusFailures
   * @memberof PxgridRestClient
   * @param {number} [startTimestamp=false] If not specified, failures from the last hour will be returned.
   * @returns {Promise} An array of failure objects.
   */
  getRadiusFailures(startTimestamp = false) {
    let payload = {};
    if (startTimestamp) payload.startTimestamp = startTimestamp;
    return this._getRest(RADIUS_SERVICE)
      .then(session => this._post(session, '/getFailures', payload))
      .then(response => response.failures)
      .catch(error => { throw new Error(error) });
  }

  /**
   * Get RADIUS failure by ID.
   * @function getRadiusFailureById
   * @memberof PxgridRestClient
   * @param {string} id Failure ID.
   * @returns {Promise} A failure object.
   */
  getRadiusFailureById(id) {
    return this._getRest(RADIUS_SERVICE)
      .then(session => this._post(session, '/getFailureById', { id: id }))
      .then(response => response)
      .catch(error => { throw new Error(error) });
  }

  subscribeToRadiusFailures(stompClient, messageCallback) {
    return this._getServiceWithSecret(RADIUS_SERVICE)
    .then(service => this._getTopicSubscriber(stompClient, service.properties.failureTopic, messageCallback));
  }


  // TrustSec
  // (currently this service only provide status of SGACL downloads via subscription)
  subscribeToTrustSecPolicyDownloads(stompClient, messageCallback) {
    return this._getServiceWithSecret(TRUSTSEC_SERVICE)
    .then(service => this._getTopicSubscriber(stompClient, service.properties.policyDownloadTopic, messageCallback));
  }


  // TrustSec Config
  /**
   * Get all Security Groups (SGTs).
   * @function getSecurityGroups
   * @memberof PxgridRestClient
   * @param {string} [id=false]  Returns all if ID not specified.
   * @returns {Promise} An array of security group objects.
   */
  getSecurityGroups(id = false) {
    let payload = {};
    if (id) payload.id = id;
    return this._getRest(TRUSTSEC_CONFIG_SERVICE)
      .then(session => this._post(session, '/getSecurityGroups', payload))
      .then(response => response.securityGroups)
      .catch(error => { throw new Error(error) });
  }

  /**
   * Get all security group ACLs (SGACLs).
   * @function getSecurityGroupAcls
   * @memberof PxgridRestClient
   * @param {string} [id=false] Returns all if ID not specified.
   * @returns {Promise} An array of SGACL objects.
   */
  getSecurityGroupAcls(id = false) {
    let payload = {};
    if (id) payload.id = id;
    return this._getRest(TRUSTSEC_CONFIG_SERVICE)
      .then(session => this._post(session, '/getSecurityGroupAcls', payload))
      .then(response => response.securityGroupAcls)
      .catch(error => { throw new Error(error) });
  }

  /**
   * Get all TrustSec egress policies.
   * @function getEgressPolicies
   * @memberof PxgridRestClient
   * @returns {Promise} An array of egress policy objects.
   */
  getEgressPolicies() {
    return this._getRest(TRUSTSEC_CONFIG_SERVICE)
      .then(session => this._post(session, '/getEgressPolicies'))
      .then(response => response.egressPolicies)
      .catch(error => { throw new Error(error) });
  }

  /**
   * Get all TrustSec egress matrices.
   * @function getEgressMatrices
   * @memberof PxgridRestClient
   * @returns {Promise} An array of egress matrix objects.
   */
  getEgressMatrices() {
    return this._getRest(TRUSTSEC_CONFIG_SERVICE)
      .then(session => this._post(session, '/getEgressMatrices'))
      .then(response => response.egressMatrices)
      .catch(error => { throw new Error(error) });
  }

  subscribeToSecurityGroups(stompClient, messageCallback) {
    return this._getServiceWithSecret(TRUSTSEC_CONFIG_SERVICE)
    .then(service => this._getTopicSubscriber(stompClient, service.properties.securityGroupTopic, messageCallback));
  }


  // TrustSec SXP
  /**
   * Get all TrustSec SXP bindings.
   * @function getSxpBindings
   * @memberof PxgridRestClient
   * @returns {Promise} An array of SXP binding objects.
   */
  getSxpBindings() {
    return this._getRest(TRUSTSEC_SXP_SERVICE)
      .then(session => this._post(session, '/getBindings'))
      .then(response => response.bindings);
  }

  subscribeToSxpBindings(stompClient, messageCallback) {
    return this._getServiceWithSecret(TRUSTSEC_SXP_SERVICE)
    .then(service => this._getTopicSubscriber(stompClient, service.properties.bindingTopic, messageCallback));
  }


  // System health functions
  /**
   * Get system health events.
   * @function getSystemHealth
   * @memberof PxgridRestClient
   *
   * @param {Object} [options={ nodeName: false, startTimestamp: false }] Will return all nodes if nodeName not specified. Will return last hour if startTimestamp not specified.
   * @returns An array of system health objects.
   */
  getSystemHealth(options = { nodeName: false, startTimestamp: false }) {
    let payload = {};
    if (options.nodeName) payload.nodeName = options.nodeName;
    if (options.startTimestamp) payload.startTimestamp = options.startTimestamp;
    return this._getRest(SYSTEM_HEALTH_SERVICE)
      .then(session => this._post(session, '/getHealths', payload))
      .then(response => response.healths);
  }

  /**
   * Get system performance events.
   * @function getSystemPerformance
   * @memberof PxgridRestClient
   * @param {Object} [options={ nodeName: false, startTimestamp: false }] Will return all nodes if nodeName not specified. Will return last hour if startTimestamp not specified.
   * @returns {Promise} An array of system performance objects.
   */
  getSystemPerformance(options = { nodeName: false, startTimestamp: false }) {
    let payload = {};
    if (options.nodeName) payload.nodeName = options.nodeName;
    if (options.startTimestamp) payload.startTimestamp = options.startTimestamp;

    return this._getRest(SYSTEM_HEALTH_SERVICE)
      .then(session => this._post(session, '/getPerformances', payload))
      .then(response => response.performances);
  }


  // Endpoint Asset Context-In
  createEndpointAssetPublisher() {
    const properties = {
      "wsPubsubService": "com.cisco.ise.pubsub",
      "assetTopic": "/topic/" + ENDPOINT_ASSET_SERVICE
    }

    return this.pxgrid.serviceRegister(ENDPOINT_ASSET_SERVICE, properties)
      .then(response => {
        this.pxgrid.autoServiceReregister(response.id, response.reregisterTimeMillis);
        return response;
      });
  }

  publishEndpointAssetUpdate(stompClient, assetBody, debug=false) {
    let binaryData;
    let data;
    if (assetBody) {
      data = { "opType": "UPDATE", "asset": assetBody }
      if (debug) {
        console.log("DATA TO BE SENT: ");
        console.log(data);
      }
      binaryData = new TextEncoder().encode(JSON.stringify(data));
    } else throw new Error('No body provided to publish.');

    if (this.endpointAssetService) {
      stompClient.publish({
        destination: this.endpointAssetService.assetTopic,
        binaryBody: binaryData,
      });
    } else {
      this._getServiceWithSecret(ENDPOINT_ASSET_SERVICE)
        .then(service => {
          this.endpointAssetService = service;
          stompClient.publish({
            destination: '/topic/' + ENDPOINT_ASSET_SERVICE,
            binaryBody: binaryData,
          });
        });
    }
  }

  subscribeToEndpointAsset(stompClient, messageCallback) {
    return this._getServiceWithSecret(ENDPOINT_ASSET_SERVICE)
      .then(service => this._getTopicSubscriber(stompClient, service.properties.assetTopic, messageCallback));
  }
}

module.exports = PxgridRestClient;
