/* eslint-disable new-cap */
const sinon = require('sinon')
const chai = require('chai')

const { expect, assert } = chai

module.exports = function () {
  const s3ClientStub = {
    send: sinon.stub(),
    middlewareStack: new Set(),
  }

  const assertSendCalledWith = (s3Command, payload) => {
    for (let i = 0; i < s3ClientStub.send.callCount; i++) {
      const call = s3ClientStub.send.getCall(i)
      const callArg = call.args[0]
      if (callArg?.name === new s3Command().name) {
        if (payload) {
          expect(callArg.payload).to.deep.equal(payload)
        }
        return
      }
    }
    assert.fail(
      `Expected S3Client to be called with '${new s3Command().name}' command but it was not called`
    )
  }

  const assertSendCallCount = (s3Command, expectedCount) => {
    const callCount = s3ClientStub.send.callCount
    let counter = 0
    for (let i = 0; i < callCount; i++) {
      const call = s3ClientStub.send.getCall(i)
      const callArg = call.args[0]
      if (callArg?.name === new s3Command().name) {
        counter++
      }
    }
    expect(counter).to.equal(expectedCount)
  }

  const assertSendNotCalledWith = s3Command => {
    for (let i = 0; i < s3ClientStub.send.callCount; i++) {
      const call = s3ClientStub.send.getCall(i)
      const callArg = call.args[0]
      if (callArg?.name === new s3Command().name) {
        assert.fail(
          `Expected S3Client not to be called with '${new s3Command().name}' command but it was called`
        )
      }
    }
  }

  const mockSend = (s3Command, response, options = {}) => {
    const mock = s3ClientStub.send.withArgs(sinon.match.instanceOf(s3Command))
    const fn = options.rejects ? 'rejects' : 'resolves'

    if (options.nextResponses?.length) {
      mock.onCall(0)[fn](response)
      for (let i = 0; i < options.nextResponses.length; i++) {
        mock.onCall(i + 1)[fn](options.nextResponses[i])
      }
    } else {
      mock[fn](response)
    }
  }

  return {
    s3ClientStub,
    assertSendCalledWith,
    assertSendCallCount,
    assertSendNotCalledWith,
    mockSend,
    S3Client: sinon.stub().returns(s3ClientStub),
    CopyObjectCommand: class DeleteObjectCommand {
      constructor(payload) {
        this.name = 'CopyObjectCommand'
        this.payload = payload
      }
    },
    DeleteObjectCommand: class DeleteObjectCommand {
      constructor(payload) {
        this.name = 'DeleteObjectCommand'
        this.payload = payload
      }
    },
    DeleteObjectsCommand: class DeleteObjectCommand {
      constructor(payload) {
        this.name = 'DeleteObjectsCommand'
        this.payload = payload
      }
    },
    GetObjectCommand: class DeleteObjectCommand {
      constructor(payload) {
        this.name = 'GetObjectCommand'
        this.payload = payload
      }
    },
    HeadObjectCommand: class DeleteObjectCommand {
      constructor(payload) {
        this.name = 'HeadObjectCommand'
        this.payload = payload
      }
    },
    ListObjectsV2Command: class DeleteObjectCommand {
      constructor(payload) {
        this.name = 'ListObjectsV2Command'
        this.payload = payload
      }
    },
  }
}
