# node-pxgrid
This is an under-development Node.js module for interacting with Cisco PxGrid 2.0 that uses REST and WebSockets along with a STOMP-based messaging protocol. You can read more about it [on Cisco DevNet](https://developer.cisco.com/docs/pxgrid/#!introduction-to-pxgrid-2-0).

It has great performance improvements over using Cisco ISE's standard REST API as well as PxGrid 1.0, as well as the obvious benefits that come with a subscribe/publish model over a general pull model.

## Documentation
[Please view the documentation here](https://rnwolfe.github.io/node-pxgrid/).

Feel free to open an issue or otherwise contact me if you feel the documentation could be improved upon.

## Creating a pxGrid Account on Cisco ISE
Currently, Cisco ISE is the only real pxGrid controller that this is likely to be used with. That being said, Cisco ISE must be properly configured in order for this to work correctly. The steps for doing so can be found here: [pxGrid Setup](https://github.com/rnwolfe/node-pxgrid/blob/master/pxgrid-setup.md).

## **Warning**: use at your own risk and/or peril.
This is not a fully fletched, fully tested, fully functional, fully professional, or fully anything else module. I'm still working on getting it to a better state where I'm comfortable saying it is likely reliable; however, it's not there, yet, and I have only done limited testing for functionality testing.

I have not integrated it into any projects to come across, and therefore fix, any real issues that may arise.

Nevertheless, it is here for your consumption and harsh ridicule.

