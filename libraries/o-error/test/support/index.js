const { expect } = require('chai')

const OError = require('../..')

exports.expectError = function OErrorExpectError(e, expected) {
  expect(
    e.name,
    "error should set the name property to the error's name"
  ).to.equal(expected.name)

  expect(
    e instanceof expected.klass,
    'error should be an instance of the error type'
  ).to.be.true

  expect(
    e instanceof Error,
    'error should be an instance of the built-in Error type'
  ).to.be.true

  expect(
    require('util').types.isNativeError(e),
    'error should be recognised by util.types.isNativeError'
  ).to.be.true

  expect(e.stack, 'error should have a stack trace').to.be.truthy

  expect(
    e.toString(),
    'toString should return the default error message formatting'
  ).to.equal(expected.message)

  expect(
    e.stack.split('\n')[0],
    'stack should start with the default error message formatting'
  ).to.match(new RegExp(`^${expected.name}:`))

  expect(
    e.stack.split('\n')[1],
    'first stack frame should be the function where the error was thrown'
  ).to.match(expected.firstFrameRx)
}

exports.expectFullStackWithoutStackFramesToEqual = function (error, expected) {
  const fullStack = OError.getFullStack(error)
  const fullStackWithoutFrames = fullStack
    .split('\n')
    .filter((line) => !/^\s+at\s/.test(line))
  expect(
    fullStackWithoutFrames,
    'full stack without frames should equal'
  ).to.deep.equal(expected)
}
