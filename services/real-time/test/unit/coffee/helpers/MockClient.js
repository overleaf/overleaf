let MockClient;
const sinon = require('sinon');

let idCounter = 0;

module.exports = (MockClient = class MockClient {
	constructor() {
		this.ol_context = {};
		this.join = sinon.stub();
		this.emit = sinon.stub();
		this.disconnect = sinon.stub();
		this.id = idCounter++;
		this.publicId = idCounter++;
	}
	disconnect() {}
});
