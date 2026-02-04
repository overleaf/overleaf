const logger = require('./')
const bunyan = require('bunyan')
const serializers = require('./serializers')

function testLogRecorder() {
  const currentTest = this.currentTest
  for (const level of ['error', 'fatal']) {
    logger[level] = (info, msg) => {
      const entry = { level, ...info, msg }
      for (const [name, fn] of Object.entries(serializers)) {
        if (name in entry) entry[name] = fn(entry[name])
      }
      currentTest.consoleErrors = (currentTest.consoleErrors || []).concat(
        JSON.stringify(info, bunyan.safeCycles())
      )
    }
  }
}

module.exports = testLogRecorder
