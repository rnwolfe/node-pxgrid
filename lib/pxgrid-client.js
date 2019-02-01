const http = require('axios');
const https = require('https');

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
    if (this.config.clientKeyPassword) httpsOptions.passphrase = clientKeyPassword;

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
}

module.exports = PxgridRestClient;
