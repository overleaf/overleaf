import sysend from 'sysend'
import sinon from 'sinon'

const sysendSpy = sinon.spy(sysend)

function resetHistory() {
  for (const method of Object.keys(sysendSpy)) {
    if (sysendSpy[method].resetHistory) sysendSpy[method].resetHistory()
  }
}

// sysends sends and receives custom calls in the background. This Helps
// filtering them out
function getDetachCalls(method) {
  return sysend[method]
    .getCalls()
    .filter(call => call.args[0].startsWith('detach-'))
}

function getLastDetachCall(method) {
  return getDetachCalls(method).pop()
}

function getLastBroacastMessage() {
  return getLastDetachCall('broadcast').args[1]
}

function getAllBroacastMessages() {
  return getDetachCalls('broadcast')
}

// this fakes receiving a message by calling the handler add to `on`. A bit
// funky, but works for now
function receiveMessage(message) {
  getLastDetachCall('on').args[1](message)
}

export default {
  spy: sysendSpy,
  resetHistory,
  getDetachCalls,
  getLastDetachCall,
  getLastBroacastMessage,
  getAllBroacastMessages,
  receiveMessage,
}
