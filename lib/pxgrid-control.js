const http = require('axios');
const https = require('https');

const ACCOUNT_ACTIVATE_URL = '/AccountActivate';
const SERVICE_LOOKUP_URL = '/ServiceLookup';
const ACCESS_SECRET_URL = '/AccessSecret';
const SERVICE_REGISTER_URL = '/ServiceRegister';
const SERVICE_REREGISTER_URL = '/ServiceReregister';
const SERVICE_UNREGISTER_URL = '/ServiceUnregister';

/**
 * @class PxgridControl
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
 * certs.certPath = './certs/';
 * certs.clientCert = fs.readFileSync(certs.certPath + 'publiccert.cer');
 * certs.clientKey = fs.readFileSync(certs.certPath + 'key.pem');
 * certs.caBundle = fs.readFileSync(certs.certPath + 'caBundle.cer');
 *
 * const PxgridControl = require('pxgrid-control');
 *
 * const pxgridControlOptions = {
 *   host: 'my-ise-server.domain.com',
 *   client: 'node-pxgrid',
 *   clientCert: certs.clientCert,
 *   clientKey: certs.clientKey,
 *   caBundle: certs.caBundle,
 *   clientKeyPassword: false,
 *   secret: '',
 *   port: '8910'
 * }
 *
 * const pxgrid = new PxgridControl(pxgridControlOptions);
 */

class PxgridControl {
  constructor({
    host,
    client,
    clientCert,
    clientKey,
    caBundle,
    clientKeyPassword,
    secret,
    port})
  {
    this.config = {
      hostname: host,
      client: client,
      port: port || '8910',
      secret: secret || '',
      clientCert: clientCert,
      clientKey: clientKey,
      clientKeyPassword: clientKeyPassword || false,
      caBundle: caBundle,
    }

    this.config.baseUrl = 'https://' + this.config.hostname + ':' + this.config.port + '/pxgrid/control'

    this.basicAuth = Buffer.from(this.config.client + ":" + this.config.secret).toString('base64');
    const httpsOptions = {
      cert: this.config.clientCert,
      key: this.config.clientKey,
      ca: this.config.caBundle,
      rejectUnauthorized: false
    };
    if (this.config.clientKeyPassword) httpsOptions.passphrase = clientKeyPassword;

    this.config.session = http.create({
      baseURL: this.config.baseUrl,
      headers: {
        'Authorization': 'Basic ' + this.basicAuth,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      httpsAgent: new https.Agent(httpsOptions)
    });

    this.registeredServices = [];

    if (!this.config.hostname || !this.config.client) {
      throw new Error('Please define hostname and a Pxgrid client name befor connecting to the pxGrid server.');
    }

  }

  _post(url, body, debug=false) {
    return this.config.session.post(url, body)
      .then(response => {
        if (debug) {
          console.debug('URL: ' + url);
          console.debug('DATA: ' + JSON.stringify(response.data));
        }
        return response.data;
      })
      .catch(error => {
        console.log(error);
      });
  }

  _accountActivate(accountDesc = 'pxgrid-node') {
    const payload = { "description": accountDesc };
    return this._post(ACCOUNT_ACTIVATE_URL, payload)
      .catch(error => { throw new Error(error) });
  }

  /**
   * Check if the PxGrid client is activated.
   * @memberof PxgridControl
   * @returns {Promise} True if the PxGrid account has been activated on the upstream PxGrid controller.
   */
  isActivated() {
    return this._accountActivate()
      .then(response => response.accountState === 'ENABLED' ? true : false)
      .catch(error => {
        console.error(">>>>>" + error);
      });
  }

  /**
   * Looks up any nodes providing the serviceName.
   * @memberof PxgridControl
   * @param  {string} serviceName Name of the service to lookup.
   * @returns {Promise} Returns a list of nodes providing the specified service, as well as their properties.
   */
  serviceLookup(serviceName) {
    const payload = { "name": serviceName };
    return this._post(SERVICE_LOOKUP_URL, payload)
      .then(response => {
        return response.services[0]
      });
  }

  /**
   * Register as a publisher to a service. This could be a new service, or an existing service.
   * @memberof PxgridControl
   * @param  {string} serviceName Name of the service to register for.
   * @param  {Object} properties Properties of the service you are registering.
   * @returns {Promise} The id and reregisterTimeMillis for the newly registered service.
   */
  serviceRegister(serviceName, properties) {
    const payload = { name: serviceName, properties: properties };
    return this._post(SERVICE_REGISTER_URL, payload)
      .then(response => {
        this.registeredServices[serviceName] = response.id;
        return response;
      })
      .catch(error => console.log(error));
  }

  /**
   * Reregister your node for a service. Services must reregister within the reregisterTimeMillis interval provided when initially registering.
   * @memberof PxgridControl
   * @see serviceRegister
   * @param  {string} serviceId The ID of the service to reregister.
   * @returns {Promise} Empty response from controller, if successful.
   */
  serviceReregister(serviceId) {
    return this._post(SERVICE_REREGISTER_URL, { id: serviceId });
  }

  /**
   * Automatically reregister a service at a given interval. Reregistration will occur 5 seconds prior to provided interval to prevent inadvertent timeouts.
   * @memberof PxgridControl
   * @see {@link serviceReregister}
   * @param {string} serviceId The ID of the service to reregister.
   * @param {number} interval Interval to reregister (milliseconds).
   * @returns nothing
   */
  autoServiceReregister(serviceId, interval) {
    setInterval(() => this.serviceReregister(serviceId), interval-5000);
  }

  /**
   * Unregisters a service.
   * @memberof PxgridControl
   * @param {string} serviceId The ID of the service to unregister.
   * @returns {Promise} Empty response from controller, if successful.
   */
  serviceUnregister(serviceId) {
    return this._post(SERVICE_UNREGISTER_URL, { id: serviceId });
  }

  /**
   * Unregisters all services that have been registered by the instance.
   * @memberof PxgridControl
   * @returns nothing
   */
  serviceUnregisterAll() {
    this.registeredServices.forEach(service => {
      this.serviceUnregister(service.id)
        .then(response => console.log(response));
    });
  }

  /**
   * Gets the Access Secret for a given node. AccessSecret is a unique secret between a Consumer and Provider pair.
   * @memberof PxgridControl
   * @param  {string} nodeName The node name to get the secret for.
   * @returns {Promise} Access Secret for node.
   */
  getAccessSecret(nodeName) {
    const payload = { "peerNodeName": nodeName };
    return this._post(ACCESS_SECRET_URL, payload);
  }

  getConfig() {
    return this.config;
  }
}

module.exports = PxgridControl;