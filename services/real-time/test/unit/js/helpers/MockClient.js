/* eslint-disable
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
let MockClient
const sinon = require('sinon')

let idCounter = 0

module.exports = MockClient = class MockClient {
  constructor() {
    this.ol_context = {}
    this.join = sinon.stub()
    this.emit = sinon.stub()
    this.disconnect = sinon.stub()
    this.id = idCounter++
    this.publicId = idCounter++
    this.joinLeaveEpoch = 0
  }

  disconnect() {}
}
