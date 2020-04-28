const { expect } = require('chai')

const OError = require('../..')

exports.expectError = function OErrorExpectError(e, expected) {
  // should set the name to the error's name
  expect(e.name).to.equal(expected.name)

  // should be an instance of the error type
  expect(e instanceof expected.klass).to.be.true

  // should be an instance of the built-in Error type
  expect(e instanceof Error).to.be.true

  // should be recognised by util.isError
  expect(require('util').types.isNativeError(e)).to.be.true

  // should have a stack trace
  expect(e.stack).to.be.truthy

  // toString should return the default error message formatting
  expect(e.toString()).to.equal(expected.message)

  // stack should start with the default error message formatting
  expect(e.stack.split('\n')[0]).to.match(new RegExp(`^${expected.name}:`))

  // first stack frame should be the function where the error was thrown
  expect(e.stack.split('\n')[1]).to.match(expected.firstFrameRx)
}

exports.expectFullStackWithoutStackFramesToEqual = function (error, expected) {
  // But the stack contains all of the errors and tags.
  const fullStack = OError.getFullStack(error)
  const fullStackWithoutFrames = fullStack
    .split('\n')
    .filter((line) => !/^\s+at\s/.test(line))
  expect(fullStackWithoutFrames).to.deep.equal(expected)
}
