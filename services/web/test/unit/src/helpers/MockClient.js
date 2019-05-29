/* eslint-disable
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let MockClient
const sinon = require('sinon')

let idCounter = 0

module.exports = MockClient = class MockClient {
  constructor() {
    this.attributes = {}
    this.join = sinon.stub()
    this.emit = sinon.stub()
    this.disconnect = sinon.stub()
    this.id = idCounter++
  }
  set(key, value, callback) {
    this.attributes[key] = value
    if (callback != null) {
      return callback()
    }
  }
  get(key, callback) {
    return callback(null, this.attributes[key])
  }
  disconnect() {}
}
