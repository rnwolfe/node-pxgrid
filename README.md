# node-pxgrid

<p align="center">
  <a href="https://npmjs.org/package/node-pxgrid"><img src="https://badgen.net/npm/v/node-pxgrid" alt="npm version" /></a>
  <a href="https://travis-ci.org/rnwolfe/node-pxgrid">
  <img src="https://travis-ci.org/rnwolfe/node-pxgrid.svg?branch=master" alt="Build Information" /></a>
  <img src="https://badgen.net/badge/code%20style/prettier/f2a" alt="Code Style: Prettier" />
  <img src="https://badgen.net/github/license/rnwolfe/node-pxgrid" alt="license" />
  <a href="https://developer.cisco.com/codeexchange/github/repo/rnwolfe/node-pxgrid"><img src="https://badgen.net/badge/cisco devnet/published/049FD9" alt="Published on Cisco Code Exchange" /></a>
</p>

This is a Node.js module for interacting with Cisco PxGrid 2.0 that uses REST and WebSockets along with a STOMP-based messaging protocol. You can read more about how pxGrid works [on Cisco DevNet](https://developer.cisco.com/docs/pxgrid/#!introduction-to-pxgrid-2-0).

It has great performance improvements over using Cisco ISE's standard REST API as well as PxGrid 1.0, as well as the obvious benefits that come with a subscribe/publish model over a general pull model.

## Documentation

[Please view the documentation here](https://rnwolfe.github.io/node-pxgrid/).

Feel free to open an issue or otherwise contact me if you feel the documentation could be improved upon.

## Installing

Install using `npm`:

```bash
npm i node-pxgrid
# or save
npm i node-pxgrid --save
```

### Creating a pxGrid account on Cisco ISE

In order to get started, you will need to create a pxGrid account on Cisco ISE. To my knowledge, Cisco ISE is the only pxGrid controller that exists today, but the package should, theoretically, support any other accurate implementation of pxGrid 2.0. This involves getting a certificate for authenticating your client. [Please follow the steps here to create an account](https://github.com/rnwolfe/node-pxgrid/blob/master/pxgrid-setup.md). Unfortunately, there is no public API that can allow us to do this programmatically at this point.

After you have an account, you can use it in your app. Note, that the initial time it registers, it will need to be approved in the pxGrid controller. If you used the above guide, this will be done automatically. The `Control.activate()` function will automatically retry every 30 seconds if it's initial state is pending. Sometimes, the auto-approval may take 1 try before completing.

## Using in an App

### Simplest Setup

```javascript
const fs = require('fs');
const Pxgrid = require('node-pxgrid');

certs = [];
certs.certPath = './certs/';
certs.clientCert = fs.readFileSync(certs.certPath + 'my-node-app.cer');
certs.clientKey = fs.readFileSync(certs.certPath + 'my-node-app.key');
certs.caBundle = fs.readFileSync(certs.certPath + 'ise-chain.cer');

const options = {
  host: 'dnaise.ironbowlab.com',
  client: 'my-node-app',
  clientCert: certs.clientCert,
  clientKey: certs.clientKey,
  caBundle: certs.caBundle,
  clientKeyPassword: 'Pxgrid123'
};

const client = new Pxgrid.Client(options);

client.connect().then(session =>
  client.subscribeToSessions(session, function(message) {
    console.log(message.body);
  })
);
```

**Note**: In version 1.1.0, the [Client#connect](https://rnwolfe.github.io/node-pxgrid/Client.html#connect) method was added in order to provide a simpler, non-jargon way to connect the broker. All examples and documentation has been updated to use this method. It was also unnecessary in a previous version to use the [Control#activate](https://rnwolfe.github.io/node-pxgrid/Control.html#activate) method; however, it was still in some examples and documentation. This should not have affected usage, but needlessly overcomplicated the examples.

### Manually Instantiate `Control` Class

**Note**: In v1.2.0, I wanted to simplify the setup of the client `Control` versus `Client` pxGrid sessions. You can now pass the options for your client directly into the `Client` class and it will automatically handle the setup of your client. However, if you need to access the `Control` class directly, you can still pass the `Control` instance to `Client` and it will handle activation if it is not already activated.

```javascript
const fs = require('fs');
const Pxgrid = require('node-pxgrid');

certs = [];
certs.certPath = './certs/';
certs.clientCert = fs.readFileSync(certs.certPath + 'my-node-app.cer');
certs.clientKey = fs.readFileSync(certs.certPath + 'my-node-app.key');
certs.caBundle = fs.readFileSync(certs.certPath + 'ise-chain.cer');

const pxgridControlOptions = {
  host: 'dnaise.ironbowlab.com',
  client: 'my-node-app',
  clientCert: certs.clientCert,
  clientKey: certs.clientKey,
  caBundle: certs.caBundle,
  clientKeyPassword: 'Pxgrid123'
};

const pxgrid = new Pxgrid.Control(pxgridControlOptions);
const client = new Pxgrid.Client(pxgrid);

client.connect().then(session =>
  client.subscribeToSessions(session, function(message) {
    console.log(message.body);
  })
);
```

For a full list of functions, please see [the documentation](https://rnwolfe.github.io/node-pxgrid/). For more example usage, see the [examples](examples/).

## Bugs

For bugs, [please open an issue](https://github.com/rnwolfe/node-pxgrid/issues).

## License

This module is licensed under the [MIT license](LICENSE).
