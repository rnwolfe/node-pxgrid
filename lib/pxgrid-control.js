const http = require('axios');
const https = require('https');

const ACCOUNT_ACTIVATE_URL = '/control/AccountActivate';
const SERVICE_LOOKUP_URL = '/control/ServiceLookup';
const ACCESS_SECRET_URL = '/control/AccessSecret';

class PxgridControl {
  constructor(
    host,
    client,
    clientCert,
    clientKey,
    caBundle,
    clientKeyPassword = false,
    secret = '',
    port = '8910')
  {
    this.config = {
      hostname: host,
      client: client,
      port: port,
      secret: secret,
      clientCert: clientCert,
      clientKey: clientKey,
      clientKeyPassword: clientKeyPassword,
      caBundle: caBundle,
      baseUrl: 'https://' + host + ':' + port + '/pxgrid'
    }

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
      });
  }

  _accountActivate(accountDesc = 'pxgrid-node') {
    const payload = { "description": accountDesc };
    return this._post(ACCOUNT_ACTIVATE_URL, payload)
      .catch(error => { throw new Error(error) });
  }

  isActivated() {
    return this._accountActivate()
      .then(response => response.accountState === 'ENABLED' ? true : false)
      .catch(error => { throw new Error(error) });
  }

  serviceLookup(serviceName) {
    const payload = { "name": serviceName };
    return this._post(SERVICE_LOOKUP_URL, payload)
      .then(response => response.services[0]);
  }

  getAccessSecret(nodeName) {
    const payload = { "peerNodeName": nodeName };
    return this._post(ACCESS_SECRET_URL, payload);
  }

  getConfig() {
    return this.config;
  }
}

module.exports = PxgridControl;