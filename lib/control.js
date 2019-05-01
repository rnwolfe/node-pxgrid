const http = require('axios');
const https = require('https');

const ACCOUNT_ACTIVATE_URL = '/AccountActivate';
const SERVICE_LOOKUP_URL = '/ServiceLookup';
const ACCESS_SECRET_URL = '/AccessSecret';
const SERVICE_REGISTER_URL = '/ServiceRegister';
const SERVICE_REREGISTER_URL = '/ServiceReregister';
const SERVICE_UNREGISTER_URL = '/ServiceUnregister';

/**
 * @class Control
 *
 * @description Establishes a PxGrid Control connection. Generally passed to a PxGrid REST Client session.
 * @constructor
 * @param {Object} options Options for the PxGrid Control instance. See examples for more information.
 * @param {string} options.host The IP or URL of the PxGrid Controller.
 * @param {number} [options.port] The host port to connect to the PxGrid Controller on.
 * @param {string} options.client The desired name of the client for the client.
 * @param {Buffer} options.clientCert A byte stream of the client public key certificate file to use.
 * @param {Buffer} options.clientKey A byte stream of the client private key file to use.
 * @param {Buffer} options.caBundle A byte stream of the CA Bundle used to verify the PxGrid Controller's identity.
 * @param {string} [options.clientKeyPassword] The password to unlock the client private key file.
 * @param {string} [options.secret] The secret to help authenticate a newly registered service.
 *
 *
 * @see {@link https://github.com/cisco-pxgrid/pxgrid-rest-ws/wiki/ Cisco PxGrid 2.0 GitHub Wiki} for more information on the Cisco PxGrid 2.0 implementation.
 *
 * @example
 *
 * const fs = require('fs');
 * certs = [];
 * certs.clientCert = fs.readFileSync('./certs/publiccert.cer');
 * certs.clientKey = fs.readFileSync('./certs/key.pem');
 * certs.caBundle = fs.readFileSync('./certs/caBundle.cer');
 *
 * const Pxgrid = require('pxgrid-node');
 *
 * const pxgridControlOptions = {
 *   host: 'my-ise-server.domain.com',
 *   client: 'my-node-app',
 *   clientCert: certs.clientCert,
 *   clientKey: certs.clientKey,
 *   caBundle: certs.caBundle,
 *   clientKeyPassword: false,
 *   secret: '',
 *   port: '8910'
 * }
 *
 * const pxcontrol = new Pxgrid.Control(pxgridControlOptions);
 */
class Control {
  constructor({
    host,
    client,
    clientCert,
    clientKey,
    caBundle,
    clientKeyPassword,
    secret,
    port
  }) {
    this.config = {
      hostname: host,
      client,
      port: port || '8910',
      secret: secret || '',
      clientCert,
      clientKey,
      clientKeyPassword: clientKeyPassword || false,
      caBundle
    };

    this.config.baseUrl = `https://${this.config.hostname}:${
      this.config.port
    }/pxgrid/control`;

    this.basicAuth = Buffer.from(
      `${this.config.client}:${this.config.secret}`
    ).toString('base64');

    const httpsOptions = {
      cert: this.config.clientCert,
      key: this.config.clientKey,
      ca: this.config.caBundle,
      rejectUnauthorized: false
    };
    if (this.config.clientKeyPassword)
      httpsOptions.passphrase = clientKeyPassword;

    this.config.session = http.create({
      baseURL: this.config.baseUrl,
      headers: {
        Authorization: `Basic ${this.basicAuth}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      httpsAgent: new https.Agent(httpsOptions)
    });

    this.registeredServices = [];

    if (!this.config.hostname || !this.config.client) {
      throw new Error(
        'Please define hostname and a Pxgrid client name befor connecting to the pxGrid server.'
      );
    }
  }

  _post(url, body, debug = false) {
    return this.config.session
      .post(url, body)
      .then(response => {
        if (debug) {
          console.debug(`URL: ${url}`);
          console.debug(`DATA: ${JSON.stringify(response.data)}`);
        }
        return response.data;
      })
      .catch(error => console.error(error.message));
  }

  _delay(time = 5000) {
    return new Promise(function(resolve) {
      setTimeout(() => {
        resolve();
      }, time);
    });
  }

  /**
   * @description
   * Activate your client pxGrid account on the controller.
   *
   * If the client is not activated, you will fail to interact with pxGrid.
   *
   * Sometimes, the account will return with a PENDING status which will induce a backoff timer of 60 seconds before retrying. This is normally because the account needs to be activated on the pxGrid Controller (either manually, or automatically). If configured for auto-approval, the activation should work in the next attempt.
   *
   * @param {string} [accountDesc='pxgrid-node'] - A description for the client you are registering.
   * @param {number} [retryInterval=60000] - Retry interval in milliseconds.
   * @param {number} [maxRetries=10] - Maximum retries that will be attempted.
   * @param {number} [retryAttempt=1] - Which attempt we are on. This is necessary since we use recursion for retries.
   * @return {Promise} True if the PxGrid account has been activated on the upstream PxGrid controller.
   * @see {@link https://github.com/cisco-pxgrid/pxgrid-rest-ws/wiki/pxGrid-Consumer#accountactivate Cisco PxGrid 2.0 GitHub Wiki - AccountActivate}
   * @memberof Control
   */
  activate(
    accountDesc = 'pxgrid-node',
    retryInterval = 60000,
    maxRetries = 10,
    retryAttempt = 1
  ) {
    const payload = { description: accountDesc };
    return (
      this._post(ACCOUNT_ACTIVATE_URL, payload)
        // eslint-disable-next-line consistent-return
        .then(response => {
          const state = response.accountState;
          if (state === 'ENABLED') {
            return true;
            // eslint-disable-next-line no-else-return
          } else if (state === 'PENDING') {
            if (retryAttempt > maxRetries) {
              throw new Error(
                `Account state is PENDING (likely requires approval or has been disabled). Hit max number of retries (${maxRetries}).`
              );
            } else {
              console.log(
                `Account state is PENDING. Retrying in ${retryInterval /
                  1000} seconds (attempt: ${retryAttempt}). The account may need to be approved on the pxGrid controller.`
              );
              return this._delay(60000).then(() => this.activate(accountDesc));
            }
          } else if (state === 'DISABLED') {
            throw new Error(
              'Client failed to activate because the account state is DISABLED! Please enable the account on the pxGrid controller and try again.'
            );
          }
        })
        .catch(error => console.error(error))
    );
  }

  /**
   * @description
   * Looks up any nodes publishing the serviceName.
   *
   * If no nodes are publishing, response is empty. Therefore, if subscribing, your subscription will fail until a publisher is registered for the service/topic.
   *
   * Will retry every `retryInterval` if no publishers are registered and activated.
   * @memberof Control
   * @param {string} serviceName - Name of the service to lookup.
   * @param {number} [retryInterval=30000] - Retry interval in milliseconds.
   * @param {number} [maxRetries=10] - Maximum retries that will be attempted.
   * @param {number} [retryAttempt=1] - Which attempt we are on. This is necessary since we use recursion for retries.
   * @return {Promise} Returns a list of nodes providing the specified service, as well as their properties. Empty if no publishers registered.
   */
  serviceLookup(
    serviceName,
    retryInterval = 30000,
    maxRetries = 10,
    retryAttempt = 1
  ) {
    const payload = { name: serviceName };
    return this._post(SERVICE_LOOKUP_URL, payload)
      .then(response => {
        if (!response.services[0]) {
          // If no publishers found, retry every 30 seconds.
          if (retryAttempt > maxRetries) {
            throw new Error(
              `No registered publisher(s) for service/topic. Hit max number of retries (${maxRetries}).`
            );
          } else {
            console.log(
              `No publishing nodes registered for service ${serviceName}, retrying in ${retryInterval /
                1000} seconds (attempt: ${retryAttempt})...`
            );
            return this._delay(retryInterval).then(() =>
              this.serviceLookup(
                serviceName,
                retryInterval,
                maxRetries,
                retryAttempt + 1
              )
            );
          }
        } else {
          return response.services[0];
        }
      })
      .catch(error => console.error(error));
  }

  /**
   * @description Register as a publisher to a service. This could be a new service, or an existing service.
   * @memberof Control
   * @param  {string} serviceName - Name of the service to register for.
   * @param  {Object} properties - Properties of the service you are registering.
   * @return {Promise} The id and reregisterTimeMillis for the newly registered service.
   */
  serviceRegister(serviceName, properties) {
    const payload = { name: serviceName, properties };
    return this._post(SERVICE_REGISTER_URL, payload)
      .then(response => {
        this.registeredServices[serviceName] = response.id;
        return response;
      })
      .catch(error => console.log(error));
  }

  /**
   * @description Reregister your node for a service. Services must reregister within the reregisterTimeMillis interval provided when initially registering.
   * @memberof Control
   * @see serviceRegister
   * @param  {string} serviceId - The ID of the service to reregister.
   * @return {Promise} Empty response from controller, if successful.
   */
  serviceReregister(serviceId) {
    return this._post(SERVICE_REREGISTER_URL, { id: serviceId });
  }

  /**
   * @description Automatically reregister a service at a given interval. Reregistration will occur 5 seconds prior to provided interval to prevent inadvertent timeouts.
   * @memberof Control
   * @see {@link serviceReregister}
   * @param {string} serviceId - The ID of the service to reregister.
   * @param {number} interval - Interval to reregister (milliseconds).
   */
  autoServiceReregister(serviceId, interval) {
    setInterval(() => this.serviceReregister(serviceId), interval - 5000);
  }

  /**
   * @description Unregisters a service.
   * @memberof Control
   * @param {string} serviceId - The ID of the service to unregister.
   * @return {Promise} Empty response from controller, if successful.
   */
  serviceUnregister(serviceId) {
    return this._post(SERVICE_UNREGISTER_URL, { id: serviceId });
  }

  /**
   * @description Unregisters all services that have been registered by the instance.
   * @memberof Control
   */
  serviceUnregisterAll() {
    this.registeredServices.forEach(service => {
      this.serviceUnregister(service.id).then(response =>
        console.log(response)
      );
    });
  }

  /**
   * @description Gets the Access Secret for a given node. AccessSecret is a unique secret between a Consumer and Provider pair.
   * @memberof Control
   * @param  {string} nodeName - The node name to get the secret for.
   * @return {Promise} Access Secret for node.
   */
  getAccessSecret(nodeName) {
    const payload = { peerNodeName: nodeName };
    return this._post(ACCESS_SECRET_URL, payload);
  }

  /**
   * @description Returns the control configuration.
   * @memberof Control
   * @return {Object} Control configuration.
   */
  getConfig() {
    return this.config;
  }
}

module.exports = Control;
