const { pxgrid, pxclient } = require('./pxgrid-setup');

/*
// Using async/await to easily perform for loop.
async function main() {
  const session = await pxclient.connect();
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

main();
*/

pxclient
  .connect()
  .then(session =>
    pxclient.createCustomPublisher(session, 'my.service.name', 'myTopic')
  )
  .then(publisher => publisher.publish({ someData: 'Some sort of data.' }));
