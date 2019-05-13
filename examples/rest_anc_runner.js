const { pxgrid, pxclient } = require('./pxgrid-setup');

async function main() {
  max = process.argv[2] || 6;
  for (let i = 0; i < max; i++) {
    if (i % 2 === 0) {
      console.log(i, Date.now() + ': applying policy.');
      await pxclient.applyAncToEndpointByMac('QUARANTINE', '11:00:00:00:00:01');
    } else {
      console.log(i, Date.now() + ': clearing policy.');
      await pxclient.clearAncFromEndpointByMac(
        'QUARANTINE',
        '11:00:00:00:00:01'
      );
    }
  }
}

main();
