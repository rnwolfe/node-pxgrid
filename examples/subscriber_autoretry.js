// This is an example to demonstrate continued attempts to connect 
// to a controller that may not be available upon startup.
const { pxgrid, pxclient } = require('./pxgrid-setup');

function handleMessage(msg) {
  console.log(msg)
}

function connect() {
  retryInterval = 5 * 1000
  pxclient
    .connect({ debug: true })
    .then(session => pxclient.subscribeToSessions(session, handleMessage))
    .catch(error => {
      if (error.toString().includes('None of the provided hosts responded')) {
        console.log(`${Date(Date.now()).toString()
          }: Failed to connect to nodes, trying again in ${retryInterval / 1000} seconds`)
        setTimeout(connect, retryInterval);
      }
    })
}

connect();