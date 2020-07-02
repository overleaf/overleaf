const { NotImplementedError } = require('./Errors')

module.exports = class AbstractPersistor {
  async sendFile(location, target, source) {
    throw new NotImplementedError({
      message: 'method not implemented in persistor',
      info: { method: 'sendFile', location, target, source }
    })
  }

  async sendStream(location, target, sourceStream, sourceMd5) {
    throw new NotImplementedError({
      message: 'method not implemented in persistor',
      info: { method: 'sendStream', location, target, sourceMd5 }
    })
  }

  // opts may be {start: Number, end: Number}
  async getObjectStream(location, name, opts) {
    throw new NotImplementedError({
      message: 'method not implemented in persistor',
      info: { method: 'getObjectStream', location, name, opts }
    })
  }

  async getRedirectUrl(location, name) {
    throw new NotImplementedError({
      message: 'method not implemented in persistor',
      info: { method: 'getRedirectUrl', location, name }
    })
  }

  async getObjectSize(location, name) {
    throw new NotImplementedError({
      message: 'method not implemented in persistor',
      info: { method: 'getObjectSize', location, name }
    })
  }

  async getObjectMd5Hash(location, name) {
    throw new NotImplementedError({
      message: 'method not implemented in persistor',
      info: { method: 'getObjectMd5Hash', location, name }
    })
  }

  async copyObject(location, fromName, toName) {
    throw new NotImplementedError({
      message: 'method not implemented in persistor',
      info: { method: 'copyObject', location, fromName, toName }
    })
  }

  async deleteObject(location, name) {
    throw new NotImplementedError({
      message: 'method not implemented in persistor',
      info: { method: 'deleteObject', location, name }
    })
  }

  async deleteDirectory(location, name) {
    throw new NotImplementedError({
      message: 'method not implemented in persistor',
      info: { method: 'deleteDirectory', location, name }
    })
  }

  async checkIfObjectExists(location, name) {
    throw new NotImplementedError({
      message: 'method not implemented in persistor',
      info: { method: 'checkIfObjectExists', location, name }
    })
  }

  async directorySize(location, name) {
    throw new NotImplementedError({
      message: 'method not implemented in persistor',
      info: { method: 'directorySize', location, name }
    })
  }
}
