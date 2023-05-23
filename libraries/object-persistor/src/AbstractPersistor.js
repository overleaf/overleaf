const { NotImplementedError } = require('./Errors')

module.exports = class AbstractPersistor {
  async sendFile(location, target, source) {
    throw new NotImplementedError('method not implemented in persistor', {
      method: 'sendFile',
      location,
      target,
      source,
    })
  }

  async sendStream(location, target, sourceStream, opts = {}) {
    throw new NotImplementedError('method not implemented in persistor', {
      method: 'sendStream',
      location,
      target,
      opts,
    })
  }

  /**
   * @param location
   * @param name
   * @param {Object} opts
   * @param {Number} opts.start
   * @param {Number} opts.end
   * @return {Promise<Readable>}
   */
  async getObjectStream(location, name, opts) {
    throw new NotImplementedError('method not implemented in persistor', {
      method: 'getObjectStream',
      location,
      name,
      opts,
    })
  }

  async getRedirectUrl(location, name) {
    throw new NotImplementedError('method not implemented in persistor', {
      method: 'getRedirectUrl',
      location,
      name,
    })
  }

  async getObjectSize(location, name) {
    throw new NotImplementedError('method not implemented in persistor', {
      method: 'getObjectSize',
      location,
      name,
    })
  }

  async getObjectMd5Hash(location, name) {
    throw new NotImplementedError('method not implemented in persistor', {
      method: 'getObjectMd5Hash',
      location,
      name,
    })
  }

  async copyObject(location, fromName, toName) {
    throw new NotImplementedError('method not implemented in persistor', {
      method: 'copyObject',
      location,
      fromName,
      toName,
    })
  }

  async deleteObject(location, name) {
    throw new NotImplementedError('method not implemented in persistor', {
      method: 'deleteObject',
      location,
      name,
    })
  }

  async deleteDirectory(location, name) {
    throw new NotImplementedError('method not implemented in persistor', {
      method: 'deleteDirectory',
      location,
      name,
    })
  }

  async checkIfObjectExists(location, name) {
    throw new NotImplementedError('method not implemented in persistor', {
      method: 'checkIfObjectExists',
      location,
      name,
    })
  }

  async directorySize(location, name) {
    throw new NotImplementedError('method not implemented in persistor', {
      method: 'directorySize',
      location,
      name,
    })
  }
}
