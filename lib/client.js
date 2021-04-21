const http = require('axios');
const https = require('https');
const WebSocket = require('ws');
const StompJs = require('@stomp/stompjs');

const Pxgrid = require('./control');

const ANC_SERVICE = 'com.cisco.ise.config.anc';
const SESSION_SERVICE = 'com.cisco.ise.session';
const PROFILER_SERVICE = 'com.cisco.ise.config.profiler';
const MDM_SERVICE = 'com.cisco.ise.mdm';
const RADIUS_SERVICE = 'com.cisco.ise.radius';
const SYSTEM_HEALTH_SERVICE = 'com.cisco.ise.system';
const TRUSTSEC_SERVICE = 'com.cisco.ise.trustsec';
const TRUSTSEC_CONFIG_SERVICE = 'com.cisco.ise.config.trustsec';
const TRUSTSEC_SXP_SERVICE = 'com.cisco.ise.sxp';
const PUBSUB_SERVICE = 'com.cisco.ise.pubsub';
const ENDPOINT_ASSET_SERVICE = 'com.cisco.endpoint.asset';

/**
 * @class Client
 *
 * @description
 * Series of functions that allow easy interaction with Cisco PxGrid 2.0 protocol implementation (typically with a Cisco ISE PxGrid Controller).
 *
 * PxGrid 2.0 makes use of REST API for push/pull options, and Web Sockets for messaging-style connections.
 *
 * The web sockets use a STOMP-based messaging framework.
 *
 * @constructor
 *
 * @param {Object} options Options for the PxGrid Control instance. See examples for more information.
 * @param {string} options.host The IP or URL of the PxGrid Controller. Deprecated in v1.3.0, please use `hosts` array.
 * @param {Object} options.hosts An array of PxGrid controllers to attempt connecting to. The first successful connection will be used.
 * @param {number} [options.port] The host port to connect to the PxGrid Controller on.
 * @param {string} options.client The desired name of the client for the client.
 * @param {Buffer} options.clientCert A byte stream of the client public key certificate file to use.
 * @param {Buffer} options.clientKey A byte stream of the client private key file to use.
 * @param {Buffer} options.caBundle A byte stream of the CA Bundle used to verify the PxGrid Controller's identity.
 * @param {Boolean} [options.verifySSL=true] If true, verify server's SSL certificate.
 * @param {number} [options.httpTimeout=1000] Value, in milliseconds, to consider a server unavailable.
 * @param {string} [options.clientKeyPassword] The password to unlock the client private key file.
 * @param {string} [options.secret] The secret to help authenticate a newly registered service.
 *
 * @see {@link Control}
 * @see {@link https://github.com/cisco-pxgrid/pxgrid-rest-ws/wiki/ Cisco PxGrid 2.0 GitHub Wiki} for more information on the Cisco PxGrid 2.0 implementation.
 *
 * @example
 * const fs = require('fs');
 * const Pxgrid = require('pxgrid-node');
 *
 * certs = [];
 * certs.clientCert = fs.readFileSync('./certs/publiccert.cer');
 * certs.clientKey = fs.readFileSync('./certs/key.pem');
 * certs.caBundle = fs.readFileSync('./certs/caBundle.cer');
 *
 * const pxgridControlOptions = {
 *   hosts: ['ise01.domain.com', 'ise02.domain.com']
 *   client: 'node-pxgrid',
 *   clientCert: certs.clientCert,
 *   clientKey: certs.clientKey,
 *   caBundle: certs.caBundle,
 *   clientKeyPassword: false,
 * }
 *
 * const pxclient = new Pxgrid.Client(options);
 *
 * pxclient.connect()
 *   .then(session => {
 *     pxclient.getProfiles()
 *        .then(profiles => console.log(profiles));
 *
 *     pxclient.applyAncToEndpointByMac('QUARANTINE', '11:00:00:00:00:01')
 *       .then(response => console.log(response));
 *   });
 */
class Client {
  constructor(
    options = {
      host,
      hosts,
      client,
      clientCert,
      clientKey,
      caBundle,
      clientKeyPassword,
      secret,
      port
    }
  ) {
    /**
     * In v1.2.0, we removed the need for the user to instantiate the Control class.
     *
     * The Client class will now handle that.
     * Instead, we handle it here by requiring the options be passed directly into the Client module.
     * This is a cleaner setup, and reduces the need for promise nesting in the user's code.
     * For backwards compatability, we need to still check if it's a Control instance as to handle
     * it correctly.
     *
     * This is deprecated, and will be removed in v2.0.0.
     */
    if (options.constructor.name === 'Control') {
      this.pxgrid = options;
    } else {
      this.pxgrid = new Pxgrid(options);
    }
    this.config = this.pxgrid.getConfig();
    this.restSessions = [];
  }

  _post(session, url, payload = {}, debug = false) {
    return session.post(url, payload).then(response => {
      if (debug) {
        console.debug(`URL: ${url}`);
        console.debug(`DATA: ${response.data}`);
      }
      return response.data;
    });
  }

  _getServiceInfo(service) {
    return this.pxgrid.serviceLookup(service);
  }

  _getServiceWithSecret(serviceName) {
    let service = {};
    return this._getServiceInfo(serviceName)
      .then(serviceInfo => {
        service = serviceInfo;
        return this._getAccessSecret(serviceInfo.nodeName);
      })
      .then(secret => {
        service.secret = secret;
        return service;
      })
      .catch(error => console.error(error));
  }

  _getAccessSecret(nodeName) {
    return this.pxgrid
      .getAccessSecret(nodeName)
      .then(response => response.secret)
      .catch(error => {
        throw new Error(error);
      });
  }

  _getRestSession(serviceName, baseUrl, nodeSecret) {
    // Check if we've already created a session for this service to prevent excessive object creation.
    if (this.restSessions[serviceName]) return this.restSessions[serviceName];

    const basicAuth = Buffer.from(
      `${this.config.client}:${nodeSecret}`
    ).toString('base64');
    const httpsOptions = {
      cert: this.config.clientCert,
      key: this.config.clientKey,
      ca: this.config.caBundle,
      rejectUnauthorized: false
    };
    if (this.config.clientKeyPassword) {
      httpsOptions.passphrase = this.config.clientKeyPassword;
    }

    const session = http.create({
      baseURL: baseUrl,
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      httpsAgent: new https.Agent(httpsOptions)
    });

    this.restSessions[serviceName] = session;
    return this.restSessions[serviceName];
  }

  _getRest(serviceName) {
    return this._getServiceWithSecret(serviceName).then(service =>
      this._getRestSession(
        service.name,
        service.properties.restBaseUrl,
        service.secret
      )
    );
  }

  // Pubsub functions
  _getPubsubWebSocket(pubsubService) {
    const basicAuth = Buffer.from(
      `${this.config.client}:${pubsubService.secret}`
    ).toString('base64');
    const headers = { Authorization: `Basic ${basicAuth}` };
    const socketOptions = {
      cert: this.config.clientCert,
      key: this.config.clientKey,
      ca: this.config.caBundle,
      rejectUnauthorized: false,
      headers
    };
    if (this.config.clientKeyPassword) {
      socketOptions.passphrase = this.config.clientKeyPassword;
    }
    return new WebSocket(pubsubService.properties.wsUrl, socketOptions);
  }

  _getTopicSubscriber(stompClient, topic, messageCallback) {
    const parseAndCallback = function(frame) {
      const message = Object.assign({}, frame);
      if (message.isBinaryBody) {
        message.body = JSON.parse(
          String.fromCharCode.apply(null, message._binaryBody)
        );
      } else {
        message.body = JSON.parse(message.body);
      }
      messageCallback(message);
    };
    return stompClient.subscribe(topic, parseAndCallback);
  }

  _getTopicPublisher(topic, topicKey) {
    const properties = {};
    properties['wsPubsubService'] = 'com.cisco.ise.pubsub';
    properties[topicKey] = `/topic/${topic}`;

    return this.pxgrid.serviceRegister(topic, properties).then(response => {
      this.pxgrid.autoServiceReregister(
        response.id,
        response.reregisterTimeMillis
      );
      return response;
    });
  }

  /**
   * @description
   * Creates a STOMP client over a Web Socket connection to the PxGrid Controller.
   *
   * This returned client object can be passed to subscribe/publish function to enable pub/sub functionality.
   *
   * @param {Object} [options] An object with desired options.
   * @param {string} [options.accountDesc='pxgrid-node'] - A description for the client you are registering.
   * @param {number} [options.retryInterval=60000] - Retry interval in milliseconds.
   * @param {number} [options.maxRetries=10] - Maximum retries that will be attempted.
   * @param {number} [options.retryAttempt=1] - Which attempt we are on. This is necessary since we use recursion for retries.
   * @param {boolean} [options.debug=false] false
   * @returns {Promise} A fully activated client session.
   * @memberof Client
   *
   * @see Client#connect
   *
   * @example
   * const ancCallback = function(message) {
   *   const body = message.body;
   *   console.log(`${Date.now()}: Endpoint ${body.macAddress} has had an ${body.status} ANC event`);
   * };
   *
   * pxclient
   *   .connect()
   *   .then(session => pxclient.subscribeToAncPolicies(session, ancCallback));
   */
  connectToBroker(
    options = {
      accountDesc: undefined,
      retryInterval: undefined,
      maxRetries: undefined,
      retryAttempt: undefined,
      debug: false
    }
  ) {
    return this.pxgrid
      .activate(
        options.accountDesc,
        options.retryInterval,
        options.maxRetries,
        options.retryAttempt
      )
      .then(() => this._getServiceWithSecret(PUBSUB_SERVICE))
      .then(pubsub => {
        const client = new StompJs.Client({
          webSocketFactory: () => this._getPubsubWebSocket(pubsub),
          debug: str => {
            if (options.debug) console.log(str);
          },
          forceBinaryWSFrames: true,
          connectHeaders: { host: pubsub.nodeName },
          stompVersions: new StompJs.Versions(['1.2']),
          reconnectDelay: 30000,
          heartbeatIncoming: 4000,
          heartbeatOutgoing: 4000
        });

        client.onConnect = frame => {
          if (options.debug) {
            console.log('Connected to STOMP broker!');
            console.log(`FRAME: ${frame}`);
          }
        };

        client.onWebSocketClose = frame => {
          if (options.debug) {
            console.log('Disconnected from STOMP broker!');
            console.log(`FRAME: ${frame}`);
          }
        };

        client.onStompError = frame => {
          console.log(`Broker reported error: ${frame.headers.message}`);
          console.log(`Additional details: ${frame.body}`);
        };

        return client;
      })
      .then(client => {
        client.activate();
        return client;
      });
  }

  // This is just for a cleaner call to connect the instance. Nothing special here.
  /**
   * @description
   * Alternative to Client.connectToBroker().
   * Primarily added to give a jargon-free method to connect.
   *
   * @param {Object} [options] An object with desired options.
   * @param {string} [options.accountDesc='pxgrid-node'] - A description for the client you are registering.
   * @param {number} [options.retryInterval=60000] - Retry interval in milliseconds.
   * @param {number} [options.maxRetries=10] - Maximum retries that will be attempted.
   * @param {number} [options.retryAttempt=1] - Which attempt we are on. This is necessary since we use recursion for retries.
   * @param {boolean} [options.debug=false] false
   * @returns {Promise} A fully activated client session.
   * @memberof Client
   *
   * @see Client#connectToBroker
   */
  connect(
    options = {
      accountDesc: undefined,
      retryInterval: undefined,
      maxRetries: undefined,
      retryAttempt: undefined,
      debug: false
    }
  ) {
    return this.connectToBroker(options);
  }

  /**
   * @description
   * Gracefully disconnects the STOMP client over a Web Socket connection to the PxGrid Controller.
   *
   * This is recommended in order to prevent excessive stale connections on the ISE server from causing issues.
   *
   * The PxGrid Controller on ISE will reap stale connections; however, if you are using multiple, rapid connections
   * it would be best to handle it directly to immediately clean unneeded connections.
   *
   * @param {Object.<stompClient>} stompClient - The active broker session to use for subscription.
   * @memberof Client
   *
   * @example
   * pxclient
   *   .connect()
   *   .then(session => pxclient.disconnect(session));
   */
  disconnect(stompClient) {
    stompClient.deactivate();
  }

  // Session directory functions
  /**
   * @description Get all active sessions.
   * @memberof Client
   * @return {Promise} An array of session objects.
   */
  getSessions() {
    return this._getRest(SESSION_SERVICE)
      .then(session => this._post(session, '/getSessions'))
      .then(response => response.sessions);
  }

  /**
   * @description Get session information for a given IP address.
   * @memberof Client
   * @param {string} ip - IP address to lookup session for.
   * @return {Promise} A session object.
   */
  getSessionByIp(ip) {
    return this._getRest(SESSION_SERVICE)
      .then(session =>
        this._post(session, '/getSessionByIpAddress', { ipAddress: ip })
      )
      .then(response => response);
  }

  /**
   * @description Get session information for a given MAC address.
   * @memberof Client
   * @param {string} mac - MAC address to lookup session for.
   * @return {Promise} A session object.
   */
  getSessionByMac(mac) {
    return this._getRest(SESSION_SERVICE)
      .then(session =>
        this._post(session, '/getSessionByMacAddress', { macAddress: mac })
      )
      .then(response => response);
  }

  /**
   * @description Gets all user groups.
   * @memberof Client
   * @return {Promise} An array of group objects.
   */
  getUserGroups() {
    return this._getRest(SESSION_SERVICE)
      .then(session => this._post(session, '/getUserGroups'))
      .then(response => response.userGroups);
  }

  /**
   * @description Gets all groups a given username is a member of.
   * @memberof Client
   * @param {string} name - User name.
   * @return {Promise} An array of group objects.
   */
  getUserGroupByUserName(name) {
    return this._getRest(SESSION_SERVICE)
      .then(session =>
        this._post(session, '/getUserGroupByUserName', { userName: name })
      )
      .then(response => response.groups);
  }

  /**
   * @description Subscribes to the sessions topic.
   * @memberof Client
   * @param {Object.<stompClient>} stompClient - The active broker session to use for subscription.
   * @param {function(messageObject)} messageCallback - A callback function that handles the message coming in on a topic subscription.
   * @return {Promise} A stomp subscriber object.
   */
  subscribeToSessions(stompClient, messageCallback) {
    return this._getServiceWithSecret(SESSION_SERVICE).then(service =>
      this._getTopicSubscriber(
        stompClient,
        service.properties.sessionTopic,
        messageCallback
      )
    );
  }

  /**
   * @description
   * Subscribes to the groups topic.
   *
   * Note: During testing, this subscription did not appear to receive any data from create, update, delete operations on user/endpoint identity groups, or adding/removing users from an identity group.
   *
   * @memberof Client
   * @param {Object.<stompClient>} stompClient - The active broker session to use for subscription.
   * @param {function(messageObject)} messageCallback - A callback function that handles the message coming in on a topic subscription.
   * @return {Promise} A stomp subscriber object.
   */
  subscribeToGroups(stompClient, messageCallback) {
    return this._getServiceWithSecret(SESSION_SERVICE).then(service =>
      this._getTopicSubscriber(
        stompClient,
        service.properties.groupTopic,
        messageCallback
      )
    );
  }

  // Profiler
  /**
   * @description Get all endpoint profiles.
   * @memberof Client
   * @return {Promise} An array of endpoint profile objects.
   */
  getProfiles() {
    return this._getRest(PROFILER_SERVICE)
      .then(session => this._post(session, '/getProfiles'))
      .then(response => response.profiles);
  }

  /**
   * @description
   * Subscribes to the profiles topic.
   *
   * Note: This topic only emits events when an endpoint profile is created or deleted. It doesn't emit anything when an endpoint changes profile.
   * @memberof Client
   * @param {Object.<stompClient>} stompClient - The active broker session to use for subscription.
   * @param {function(messageObject)} messageCallback - A callback function that handles the message coming in on a topic subscription.
   * @return {Promise} A stomp subscriber object.
   */
  subscribeToProfiler(stompClient, messageCallback) {
    // This topic doesn't appear to emit any data when an endpoint changes profile,
    // or when a profile is created/deleted. Not sure if there's anything being published.
    return this._getServiceWithSecret(PROFILER_SERVICE).then(service =>
      this._getTopicSubscriber(
        stompClient,
        service.properties.topic,
        messageCallback
      )
    );
  }

  // MDM
  // I don't have MDM integrated with ISE, so unable to fully test some of these.
  /**
   * @description Gets MDM endpoints.
   * @memberof Client
   * @param {boolean} [filter=false] - Filter to restrict endpoints returned.
   * @see {@link https://github.com/cisco-pxgrid/pxgrid-rest-ws/wiki/MDM#endpoint-object PxGrid MDM Documentation} for endpoint object used for filter.
   * @return {Promise} An array of MDM endpoint objects.
   */
  getMdmEndpoints(filter = false) {
    const payload = {};
    if (filter) payload.filter = filter;
    return this._getRest(MDM_SERVICE)
      .then(session => this._post(session, '/getEndpoints', payload))
      .then(response => response.endpoints)
      .catch(error => console.error(error));
  }

  /**
   * @description Gets an MDM endpoints by MAC address.
   * @memberof Client
   * @param {string} mac - MAC address of MDM client to retrieve.
   * @return {Promise} An MDM endpoint object.
   */
  getMdmEndpointByMac(mac) {
    return this._getRest(MDM_SERVICE)
      .then(session =>
        this._post(session, '/getEndpointByMacAddress', { macAddress: mac })
      )
      .then(response => response)
      .catch(error => console.error(error));
  }

  /**
   * @description Get an MDM endpoint by type.
   * @memberof Client
   * @param {string} type - Value must be 'NON_COMPLIANT', 'REGISTERED', or 'DISCONNECTED'.
   * @return {Promise} An array of MDM endpoint objects.
   */
  getMdmEndpointsByType(type) {
    if (!type)
      throw new Error(
        'Must specify a type of NON_COMPLIANT, REGISTERED, or DISCONNECTED.'
      );
    return this._getRest(MDM_SERVICE)
      .then(session => this._post(session, '/getEndpointsByType', { type }))
      .then(response => response.endpoints)
      .catch(error => console.error(error));
  }

  /**
   * @description Get an MDM endpoint by OS type.
   * @memberof Client
   * @param {string} osType - Value must be 'ANDROID', 'IOS', or 'WINDOWS'.
   * @return {Promise} An MDM endpoint object.
   */
  getMdmEndpointsByOs(osType) {
    if (!osType)
      throw new Error('Must specify an OS of ANDROID, IOS, or WINDOWS.');
    return this._getRest(MDM_SERVICE)
      .then(session => this._post(session, '/getEndpointsByOsType', { osType }))
      .then(response => response.endpoints)
      .catch(error => console.error(error));
  }

  /**
   * @description Subscribes to the MDM endpoints topic.
   * @memberof Client
   * @param {Object.<stompClient>} stompClient - The active broker session to use for subscription.
   * @param {function(messageObject)} messageCallback - A callback function that handles the message coming in on a topic subscription.
   * @return {Promise} A stomp subscriber object.
   */
  subscribeToMdmEndpoints(stompClient, messageCallback) {
    return this._getServiceWithSecret(MDM_SERVICE).then(service =>
      this._getTopicSubscriber(
        stompClient,
        service.properties.endpointTopic,
        messageCallback
      )
    );
  }

  // Adaptive Network Control (ANC)
  /**
   * @description Get all ANC policies.
   * @memberof Client
   * @return {Promise} An array of ANC policy objects.
   */
  getAncPolicies() {
    return this._getRest(ANC_SERVICE)
      .then(session => this._post(session, '/getPolicies'))
      .then(response => response.policies);
  }

  /**
   * @description Gets an ANC policy details by name.
   * @memberof Client
   * @param {string} name - Name of an existing ANC policy.
   * @return {Promise} An ANC policy object.
   */
  getAncPolicyByName(name) {
    return this._getRest(ANC_SERVICE)
      .then(session => this._post(session, '/getPolicyByName', { name }))
      .then(response => response);
  }

  /**
   * @description Create a new ANC policy.
   * @memberof Client
   * @param {string} name - The name of the new ANC policy.
   * @param {Object} actions - Actions must be an array, and there must only be one item in the array. Acceptable values are 'QUARANTINE', 'SHUT_DOWN', 'PORT_BOUNCE'.
   * @return {Promise} An ANC policy object.
   */
  createAncPolicy(name, actions) {
    if (typeof actions !== 'object')
      throw new Error("'actions' must be an object.");
    return this._getRest(ANC_SERVICE)
      .then(session => this._post(session, '/createPolicy', { name, actions }))
      .catch(error => {
        throw new Error(error.response.data.message);
      });
  }

  /**
   * @description Deletes an ANC policy.
   * @memberof Client
   * @param {string} name - The name of the ANC policy to be deleted.
   * @return {Promise} Empty.
   */
  deleteAncPolicy(name) {
    return this._getRest(ANC_SERVICE)
      .then(session => this._post(session, '/deletePolicyByName', { name }))
      .catch(error => {
        throw new Error(error);
      });
  }

  /**
   * @description Get all endpoints assigned an ANC policy.
   * @memberof Client
   * @return {Promise} An array of endpoint objects.
   */
  getAncEndpoints() {
    return this._getRest(ANC_SERVICE)
      .then(session => this._post(session, '/getEndpoints'))
      .catch(error => {
        throw new Error(error);
      });
  }

  /**
   * @description Get ANC policy for MAC address.
   * @memberof Client
   * @param {string} mac - MAC address of endpoint.
   * @return {Promise} An ANC endpoint object.
   */
  getAncEndpointByMac(mac) {
    return this._getRest(ANC_SERVICE)
      .then(session =>
        this._post(session, '/getEndpointByMacAddress', { macAddress: mac })
      )
      .catch(error => {
        throw new Error(error);
      });
  }

  /**
   * @description Apply an ANC policy to an endpoint by MAC address.
   * @memberof Client
   * @param {string} policy - The name of the ANC policy to apply.
   * @param {string} mac - The MAC address to apply the policy to.
   * @return {Promise} A status object.
   */
  applyAncToEndpointByMac(policy, mac) {
    return this._getRest(ANC_SERVICE)
      .then(session =>
        this._post(session, '/applyEndpointByMacAddress', {
          policyName: policy,
          macAddress: mac
        })
      )
      .catch(error => {
        throw new Error(error);
      });
  }

  /**
   * @description Clears an ANC policy from an endpoint by MAC address.
   * @memberof Client
   * @param {string} policy - The name of the ANC policy to clear.
   * @param {string} mac - The MAC address to clear the policy from.
   * @return {Promise} A status object.
   */
  clearAncFromEndpointByMac(policy, mac) {
    return this._getRest(ANC_SERVICE)
      .then(session =>
        this._post(session, '/clearEndpointByMacAddress', {
          policyName: policy,
          macAddress: mac
        })
      )
      .catch(error => {
        throw new Error(error);
      });
  }

  /**
   * @description Apply an ANC policy to an endpoint by IP address.
   * @memberof Client
   * @param {string} policy - The name of the ANC policy to apply.
   * @param {string} ip - The IP address to apply the policy to.
   * @return {Promise} A status object.
   */
  applyAncToEndpointByIp(policy, ip) {
    return this._getRest(ANC_SERVICE)
      .then(session =>
        this._post(session, '/applyEndpointByIpAddress', {
          policyName: policy,
          ipAddress: ip
        })
      )
      .catch(error => {
        throw new Error(error);
      });
  }

  /**
   * @description Clears an ANC policy from an endpoint by IP address.
   * @memberof Client
   * @param {string} policy - The name of the ANC policy to clear.
   * @param {string} ip - The IP address to clear the policy from.
   * @return {Promise} A status object.
   */
  clearAncFromEndpointByIp(policy, ip) {
    return this._getRest(ANC_SERVICE)
      .then(session =>
        this._post(session, '/clearEndpointByIpAddress', {
          policyName: policy,
          ipAddress: ip
        })
      )
      .catch(error => {
        throw new Error(error);
      });
  }

  /**
   * @description
   * The status of an ANC operation.
   * If operation does not exist, HTTP status "204 No content" will be returned.
   * @memberof Client
   * @param {string} id - An operation ID.
   * @return {Promise} A status object.
   */
  getAncOperationStatus(id) {
    return this._getRest(ANC_SERVICE)
      .then(session =>
        this._post(session, '/getOperationStatus', { operationId: id })
      )
      .catch(error => {
        throw new Error(error);
      });
  }

  /**
   * @description Subscribes to the ANC policy topic. Messages generated for endpoints being applied or cleared from an ANC policy.
   * @memberof Client
   * @param {Object.<stompClient>} stompClient - The active broker session to use for subscription.
   * @param {function(messageObject)} messageCallback - A callback function that handles the message coming in on a topic subscription.
   * @return {Promise} A stomp subscriber object.
   */
  subscribeToAncPolicies(stompClient, messageCallback) {
    return this._getServiceWithSecret(ANC_SERVICE).then(service =>
      this._getTopicSubscriber(
        stompClient,
        service.properties.statusTopic,
        messageCallback
      )
    );
  }

  // RADIUS
  /**
   * @description Get all RADIUS failures.
   * @memberof Client
   * @param {number} [startTimestamp=false] - If not specified, failures from the last hour will be returned.
   * @return {Promise} An array of failure objects.
   */
  getRadiusFailures(startTimestamp = false) {
    const payload = {};
    if (startTimestamp) payload.startTimestamp = startTimestamp;
    return this._getRest(RADIUS_SERVICE)
      .then(session => this._post(session, '/getFailures', payload))
      .then(response => response.failures)
      .catch(error => {
        throw new Error(error);
      });
  }

  /**
   * @description Get RADIUS failure by ID.
   * @memberof Client
   * @param {string} id - Failure ID.
   * @return {Promise} A failure object.
   */
  getRadiusFailureById(id) {
    return this._getRest(RADIUS_SERVICE)
      .then(session => this._post(session, '/getFailureById', { id }))
      .then(response => response)
      .catch(error => {
        throw new Error(error);
      });
  }

  /**
   * @description Subscribes to the RADIUS failures topic.
   * @memberof Client
   * @param {Object.<stompClient>} stompClient - The active broker session to use for subscription.
   * @param {function(messageObject)} messageCallback - A callback function that handles the message coming in on a topic subscription.
   * @return {Promise} A stomp subscriber object.
   */
  subscribeToRadiusFailures(stompClient, messageCallback) {
    return this._getServiceWithSecret(RADIUS_SERVICE).then(service =>
      this._getTopicSubscriber(
        stompClient,
        service.properties.failureTopic,
        messageCallback
      )
    );
  }

  // TrustSec
  /**
   * @description
   * Subscribes to the groups topic.
   *
   * Note: this service only provide status of SGACL downloads via subscription (as of ISE 2.4).
   * @memberof Client
   * @param {Object.<stompClient>} stompClient - The active broker session to use for subscription.
   * @param {function(messageObject)} messageCallback - A callback function that handles the message coming in on a topic subscription.
   * @return {Promise} A stomp subscriber object.
   */
  subscribeToTrustSecPolicyDownloads(stompClient, messageCallback) {
    return this._getServiceWithSecret(TRUSTSEC_SERVICE).then(service =>
      this._getTopicSubscriber(
        stompClient,
        service.properties.policyDownloadTopic,
        messageCallback
      )
    );
  }

  // TrustSec Config
  /**
   * @description Get all Security Groups (SGTs).
   * @memberof Client
   * @param {string} [id=false] - Returns all if ID not specified.
   * @return {Promise} An array of security group objects.
   */
  getSecurityGroups(id = false) {
    const payload = {};
    if (id) payload.id = id;
    return this._getRest(TRUSTSEC_CONFIG_SERVICE)
      .then(session => this._post(session, '/getSecurityGroups', payload))
      .then(response => response.securityGroups)
      .catch(error => {
        throw new Error(error);
      });
  }

  /**
   * @description Get all security group ACLs (SGACLs).
   * @memberof Client
   * @param {string} [id=false] - Returns all if ID not specified.
   * @return {Promise} An array of SGACL objects.
   */
  getSecurityGroupAcls(id = false) {
    const payload = {};
    if (id) payload.id = id;
    return this._getRest(TRUSTSEC_CONFIG_SERVICE)
      .then(session => this._post(session, '/getSecurityGroupAcls', payload))
      .then(response => response.securityGroupAcls)
      .catch(error => {
        throw new Error(error);
      });
  }

  /**
   * @description Get all TrustSec egress policies.
   * @memberof Client
   * @return {Promise} An array of egress policy objects.
   */
  getEgressPolicies() {
    return this._getRest(TRUSTSEC_CONFIG_SERVICE)
      .then(session => this._post(session, '/getEgressPolicies'))
      .then(response => response.egressPolicies)
      .catch(error => {
        throw new Error(error);
      });
  }

  /**
   * @description Get all TrustSec egress matrices.
   * @memberof Client
   * @return {Promise} An array of egress matrix objects.
   */
  getEgressMatrices() {
    return this._getRest(TRUSTSEC_CONFIG_SERVICE)
      .then(session => this._post(session, '/getEgressMatrices'))
      .then(response => response.egressMatrices)
      .catch(error => {
        throw new Error(error);
      });
  }

  /**
   * @description
   * Subscribes to the Security Groups (SGTs) topic.
   *
   * @memberof Client
   * @param {Object.<stompClient>} stompClient - The active broker session to use for subscription.
   * @param {function(messageObject)} messageCallback - A callback function that handles the message coming in on a topic subscription.
   * @return {Promise} A stomp subscriber object.
   */
  subscribeToSecurityGroups(stompClient, messageCallback) {
    return this._getServiceWithSecret(TRUSTSEC_CONFIG_SERVICE).then(service =>
      this._getTopicSubscriber(
        stompClient,
        service.properties.securityGroupTopic,
        messageCallback
      )
    );
  }

  // TrustSec SXP
  /**
   * @description
   * Get all TrustSec SXP bindings.
   *
   * Note: Results are only returned for IP SGT Static Mapping, and only if an SXP device is configured with the SXP service enabled. Otherwise, nothing is returned (even if mappings are configured).
   *
   * @memberof Client
   * @return {Promise} An array of SXP binding objects.
   */
  getSxpBindings() {
    return this._getRest(TRUSTSEC_SXP_SERVICE)
      .then(session => this._post(session, '/getBindings'))
      .then(response => response.bindings);
  }

  /**
   * @description
   * Subscribes to the SXP bindings topic.
   *
   * Note: During testing, this topic did not emit any events for new SXP bindings (IP-SGT Mappings) or new SXP connections.
   *
   * @memberof Client
   * @param {Object.<stompClient>} stompClient - The active broker session to use for subscription.
   * @param {function(messageObject)} messageCallback - A callback function that handles the message coming in on a topic subscription.
   * @return {Promise} A stomp subscriber object.
   */
  subscribeToSxpBindings(stompClient, messageCallback) {
    return this._getServiceWithSecret(TRUSTSEC_SXP_SERVICE).then(service =>
      this._getTopicSubscriber(
        stompClient,
        service.properties.bindingTopic,
        messageCallback
      )
    );
  }

  // System health functions
  /**
   * @description Get system health events.
   * @memberof Client
   *
   * @param {Object} options - Options for filtering the system health events.
   * @param {string} [options.nodeName] - The name of the node to get system health for. Will return all nodes if nodeName not specified.
   * @param {ISO8601Datetime} [options.startTimestamp] - The timestamp to begin getting events with. Will return last hour if startTimestamp not specified.
   * @return {Promise} An array of system health objects.
   */
  getSystemHealth(options = { nodeName: false, startTimestamp: false }) {
    const payload = {};
    if (options.nodeName) payload.nodeName = options.nodeName;
    if (options.startTimestamp) payload.startTimestamp = options.startTimestamp;
    return this._getRest(SYSTEM_HEALTH_SERVICE)
      .then(session => this._post(session, '/getHealths', payload))
      .then(response => response.healths);
  }

  /**
   * @description Get system performance events.
   * @memberof Client
   * @param {Object} options - Options for filtering the system performance.
   * @param {string} [options.nodeName] - The name of the node to get system performance for. Will return all nodes if nodeName not specified.
   * @param {ISO8601Datetime} [options.startTimestamp] - The timestamp to begin getting events with. Will return last hour if startTimestamp not specified.
   * @return {Promise} An array of system performance objects.
   */
  getSystemPerformance(options = { nodeName: false, startTimestamp: false }) {
    const payload = {};
    if (options.nodeName) payload.nodeName = options.nodeName;
    if (options.startTimestamp) payload.startTimestamp = options.startTimestamp;

    return this._getRest(SYSTEM_HEALTH_SERVICE)
      .then(session => this._post(session, '/getPerformances', payload))
      .then(response => response.performances);
  }

  // Endpoint Asset Context-In
  /**
   * @description Creates a publisher for the Endpoint Asset service. This also registers the client as a publisher for the topic with the controller.
   * @memberof Client
   * @return {Promise} A status object.
   */
  createEndpointAssetPublisher() {
    return this._getTopicPublisher(ENDPOINT_ASSET_SERVICE, 'assetTopic');
  }

  /**
   * @description
   * Publish an endpoint asset update.
   *
   * This allows the addition of attributes from the IOTAsset dictionary, as well as any pre-configured custom attributes, into the endpoint.
   *
   * Note: The Cisco ISE pxGrid Profiler Probe must be enabled for this published event to be processed by ISE. This is not on by default.
   *
   * @param {Object.<stompClient>} stompClient - The active broker session to use for subscription.
   * @param {Object} assetBody - A JSON object of asset information to publish to an endpoint.
   * @param {string} assetBody.assetMacAddress - MAC address of endpoint.
   * @param {string} assetBody.assetId - Arbitrary value.
   * @param {string} assetBody.assetName - Arbitrary value.
   * @param {string} assetBody.assetHwRevision - Arbitrary value.
   * @param {string} assetBody.assetProtocol - Arbitrary value.
   * @param {string} assetBody.assetVendor - Arbitrary value.
   * @param {string} assetBody.assetSwRevision - Arbitrary value.
   * @param {string} assetBody.assetProductId - Arbitrary value.
   * @param {string} assetBody.assetSerialNumber - Arbitrary value.
   * @param {string} assetBody.assetDeviceType - Arbitrary value.
   * @param {string} assetBody.assetIpAddress - Arbitrary value.
   * @param {string} assetBody.assetCustomAttributes - Arbitrary value.
   * @param {string} assetBody.assetConnectedLinks - Arbitrary value.
   * @param {Object} assetBody.assetConnectedAttributes - Any other custom attributes that have been created in Cisco ISE.
   * @param {string} assetBody.assetCustomAttributes.attrName - AttrName should match name of custom attribute in ISE. Value is arbitrary.
   * @param {boolean} [debug=false] - Enables debug messages being logged to console.
   * @memberof Client
   */
  publishEndpointAssetUpdate(stompClient, assetBody, debug = false) {
    let binaryData;
    let data;
    if (assetBody) {
      data = { opType: 'UPDATE', asset: assetBody };
      if (debug) {
        console.log('DATA TO BE SENT: ');
        console.log(data);
      }
      binaryData = new TextEncoder().encode(JSON.stringify(data));
    } else throw new Error('No body provided to publish.');

    if (this.endpointAssetService) {
      stompClient.publish({
        destination: this.endpointAssetService.assetTopic,
        binaryBody: binaryData
      });
    } else {
      this._getServiceWithSecret(ENDPOINT_ASSET_SERVICE).then(service => {
        this.endpointAssetService = service;
        stompClient.publish({
          destination: `/topic/${ENDPOINT_ASSET_SERVICE}`,
          binaryBody: binaryData
        });
      });
    }
  }

  /**
   * @description Subscribes to the Endpoint Asset topic.
   * @memberof Client
   * @param {Object.<stompClient>} stompClient - The active broker session to use for subscription.
   * @param {function(messageObject)} messageCallback - A callback function that handles the message coming in on a topic subscription.
   * @return {Promise} A stomp subscriber object.
   */
  subscribeToEndpointAsset(stompClient, messageCallback) {
    return this._getServiceWithSecret(ENDPOINT_ASSET_SERVICE).then(service =>
      this._getTopicSubscriber(
        stompClient,
        service.properties.assetTopic,
        messageCallback
      )
    );
  }

  /**
   * @description
   * Subscribes to all pre-defined topics.
   *
   * @memberof Client
   * @param {Object.<stompClient>} stompClient - The active broker session to use for subscription.
   * @param {function(messageObject)} messageCallback - A callback function that handles the message coming in on a topic subscription.
   */
  subscribeToAllTopics(stompClient, messageCallback) {
    this.subscribeToAncPolicies(stompClient, messageCallback);
    this.subscribeToEndpointAsset(stompClient, messageCallback);
    this.subscribeToGroups(stompClient, messageCallback);
    this.subscribeToMdmEndpoints(stompClient, messageCallback);
    this.subscribeToProfiler(stompClient, messageCallback);
    this.subscribeToRadiusFailures(stompClient, messageCallback);
    this.subscribeToSecurityGroups(stompClient, messageCallback);
    this.subscribeToSessions(stompClient, messageCallback);
    this.subscribeToSxpBindings(stompClient, messageCallback);
    this.subscribeToTrustSecPolicyDownloads(stompClient, messageCallback);
  }

  // CUSTOM TOPICS
  /**
   * @description
   * Creates a publisher for a custom topic.
   * This also registers the client as a service for the topic with the controller.
   *
   * @param {Object.<stompClient>} stompClient - The active broker session to use for subscription.
   * @param {string} service The custom service name that is providing the topic.
   * @param {string} topic The custom topic.
   * @param {boolean} [debug=false] Enables debugging.
   * @return {Object.publisher} A publisher object.
   * @memberof Client
   *
   * @example
   * pxclient
   *  .connect()
   *  .then(session => pxclient.createCustomPublisher(session, 'my.service.name', 'myTopic'))
   *  .then(publisher => publisher.publish({ someData: 'Some sort of data.' }));
   */
  createCustomPublisher(stompClient, service, topic, debug = false) {
    return this._getTopicPublisher(service, topic).then(() => {
      service = `/topic/${service}`;
      return {
        service: service,
        topic: topic,
        publish: body => {
          let binaryData;
          if (body) {
            if (debug) {
              console.log('DATA TO BE SENT: ');
              console.log(body);
            }
            binaryData = new TextEncoder().encode(JSON.stringify(body));
          } else throw new Error('No body provided to publish.');

          return stompClient.publish({
            destination: service,
            binaryBody: binaryData
          });
        }
      };
    });
  }

  /**
   * @description
   * Subscribes to a custom topic on a specified service.
   * This topic is assumed as previously created using Client.createCustomPublisher() or otherwise.
   *
   * @memberof Client
   * @param {Object.<stompClient>} stompClient - The active broker session to use for subscription.
   * @param {string} service The custom service name that is providing the topic.
   * @param {string} topic The custom topic.
   * @param {function(messageObject)} messageCallback - A callback function that handles the message coming in on a topic subscription.
   * @param {boolean} [debug=false] Enables debugging.
   * @memberof Client
   *
   * @example
   * pxclient
   *   .connect()
   *   .then(session => pxclient.subscribeToCustom(session, 'blah.blah.blah', 'customTopic', genericCallback));
   */
  subscribeToCustom(
    stompClient,
    service,
    topic,
    messageCallback,
    debug = false
  ) {
    return this._getServiceWithSecret(service).then(service => {
      if (debug) {
        console.log(service);
        console.log(service.properties[topic]);
      }
      this._getTopicSubscriber(
        stompClient,
        service.properties[topic],
        messageCallback
      );
    });
  }
}

module.exports = Client;
