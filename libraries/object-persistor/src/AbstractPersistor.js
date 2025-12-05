const { NotImplementedError } = require('./Errors')

module.exports = class AbstractPersistor {
  /**
   * @param location
   * @param target
   * @param {string} source
   * @return {Promise<void>}
   */
  async sendFile(location, target, source) {
    throw new NotImplementedError('method not implemented in persistor', {
      method: 'sendFile',
      location,
      target,
      source,
    })
  }

  /**
   * @param location
   * @param target
   * @param {NodeJS.ReadableStream} sourceStream
   * @param {Object} opts
   * @return {Promise<void>}
   */
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
   * @param {Object} [opts]
   * @param {Number} [opts.start]
   * @param {Number} [opts.end]
   * @return {Promise<NodeJS.ReadableStream>}
   */
  async getObjectStream(location, name, opts = {}) {
    throw new NotImplementedError('method not implemented in persistor', {
      method: 'getObjectStream',
      location,
      name,
      opts,
    })
  }

  /**
   * @param {string} location
   * @param {string} name
   * @return {Promise<string>}
   */
  async getRedirectUrl(location, name) {
    throw new NotImplementedError('method not implemented in persistor', {
      method: 'getRedirectUrl',
      location,
      name,
    })
  }

  /**
   * @param {string} location
   * @param {string} name
   * @param {Object} opts
   * @return {Promise<number>}
   */
  async getObjectSize(location, name, opts) {
    throw new NotImplementedError('method not implemented in persistor', {
      method: 'getObjectSize',
      location,
      name,
    })
  }

  /**
   * @param {string} location
   * @param {string} name
   * @param {Object} opts
   * @return {Promise<string>}
   */
  async getObjectMd5Hash(location, name, opts) {
    throw new NotImplementedError('method not implemented in persistor', {
      method: 'getObjectMd5Hash',
      location,
      name,
    })
  }

  /**
   * @param {string} location
   * @param {string} fromName
   * @param {string} toName
   * @param {Object} opts
   * @return {Promise<void>}
   */
  async copyObject(location, fromName, toName, opts) {
    throw new NotImplementedError('method not implemented in persistor', {
      method: 'copyObject',
      location,
      fromName,
      toName,
    })
  }

  /**
   * @param {string} location
   * @param {string} name
   * @return {Promise<void>}
   */
  async deleteObject(location, name) {
    throw new NotImplementedError('method not implemented in persistor', {
      method: 'deleteObject',
      location,
      name,
    })
  }

  /**
   * @param {string} location
   * @param {string} name
   * @param {string} [continuationToken]
   * @return {Promise<void>}
   */
  async deleteDirectory(location, name, continuationToken) {
    throw new NotImplementedError('method not implemented in persistor', {
      method: 'deleteDirectory',
      location,
      name,
    })
  }

  /**
   * @param {string} location
   * @param {string} name
   * @param {Object} opts
   * @return {Promise<boolean>}
   */
  async checkIfObjectExists(location, name, opts) {
    throw new NotImplementedError('method not implemented in persistor', {
      method: 'checkIfObjectExists',
      location,
      name,
    })
  }

  /**
   * @param {string} location
   * @param {string} name
   * @param {string} [continuationToken]
   * @return {Promise<number>}
   */
  async directorySize(location, name, continuationToken) {
    throw new NotImplementedError('method not implemented in persistor', {
      method: 'directorySize',
      location,
      name,
    })
  }

  /**
   * List objects in a directory, returning the full keys.
   *
   * Suitable only for directories where the number of keys is known to be small.
   *
   * @param {string} location
   * @param {string} prefix
   * @returns {Promise<Array<string>>}
   */
  async listDirectoryKeys(location, prefix) {
    throw new NotImplementedError('method not implemented in persistor', {
      method: 'listDirectoryKeys',
      location,
      prefix,
    })
  }

  /**
   * List objects in a directory, returning key and size information.
   *
   * Suitable only for directories where the number of keys is known to be small.
   *
   * @param {string} location
   * @param {string} prefix
   * @returns {Promise<Array<{key: string, size: number}>>}
   */
  async listDirectoryStats(location, prefix) {
    throw new NotImplementedError('method not implemented in persistor', {
      method: 'listDirectoryStats',
      location,
      prefix,
    })
  }
}
