const { pxgrid, pxclient } = require('./pxgrid-setup');

// Using async/await to easily perform for loop.
async function main() {
  const session = await pxclient.connectToBroker();
  const publisher = await pxclient.createCustomPublisher(
    session,
    'blah.blah.blah',
    'customTopic'
  );
  max = process.argv[2] || 6;
  for (let i = 0; i < max; i++) {
    console.log(i, Date.now() + ': sending message.');
    publisher.publish({ testAttribute: 'test ' + i });
  }
}

pxgrid.activate().then(() => main());
