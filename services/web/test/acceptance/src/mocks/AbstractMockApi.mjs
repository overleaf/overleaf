import OError from '@overleaf/o-error'
import express from 'express'
import bodyParser from 'body-parser'

/**
 * Abstract class for running a mock API via Express. Handles setting up of
 * the server on a specific port, and provides an overridable method to
 * initialise routes.
 *
 * Mocks are singletons, and must be initialized with the `initialize` method.
 * Instance objects are available via the `instance()` method.
 *
 * You must override 'reset' and 'applyRoutes' when subclassing this
 *
 * Wraps the express app's http verb methods for convenience
 *
 * @hideconstructor
 * @member {number} port - the port for the http server
 * @member app - the Express application
 */
class AbstractMockApi {
  /**
   * Create a new API. No not call directly - use the `initialize` method
   *
   * @param {number} port - The TCP port to start the API on
   * @param {object} options - An optional hash of options to modify the behaviour of the mock
   * @param {boolean} options.debug - When true, print http requests and responses to stdout
   *                                  Set this to 'true' from the constructor of your derived class
   */
  constructor(port, { debug } = {}) {
    if (!this.constructor._fromInit) {
      throw new OError(
        'do not create this class directly - use the initialize method',
        { className: this.constructor.name }
      )
    }
    if (this.constructor._obj) {
      throw new OError('mock already initialized', {
        className: this.constructor._obj.constructor.name,
        port: this.port,
      })
    }
    if (this.constructor === AbstractMockApi) {
      throw new OError(
        'Do not construct AbstractMockApi directly - use a subclass'
      )
    }

    this.debug = debug
    this.port = port
    this.app = express()
    this.app.use(bodyParser.json())
    this.app.use(bodyParser.urlencoded({ extended: true }))
  }

  /**
   * Apply debugging routes to print out API activity to stdout
   */
  applyDebugRoutes() {
    if (!this.debug) return
    this.app.use((req, res, next) => {
      const { method, path, query, params, body } = req
      // eslint-disable-next-line no-console
      console.log(`${this.constructor.name} REQUEST`, {
        method,
        path,
        query,
        params,
        body,
      })
      const oldEnd = res.end
      const oldJson = res.json
      res.json = (...args) => {
        // eslint-disable-next-line no-console
        console.log(`${this.constructor.name} RESPONSE JSON`, args[0])
        oldJson.call(res, ...args)
      }
      res.end = (...args) => {
        // eslint-disable-next-line no-console
        console.log(`${this.constructor.name} STATUS`, res.statusCode)
        if (res.statusCode >= 500) {
          // eslint-disable-next-line no-console
          console.log('ERROR RESPONSE:', args)
        }
        oldEnd.call(res, ...args)
      }
      next()
    })
  }

  /**
   * Overridable method to add routes - should be overridden in derived classes
   * @abstract
   */
  applyRoutes() {
    throw new OError(
      'AbstractMockApi base class implementation should not be called'
    )
  }

  /**
   * Resets member data and restores the API to a clean state for the next test run
   * - may be overridden in derived classes
   */
  reset() {}

  /**
   * Applies mocha hooks to start and stop the API at the beginning/end of
   * the test suite, and reset before each test run
   *
   * @param {number} port - The TCP port to start the API on
   * @param {object} options - An optional hash of options to modify the behaviour of the mock
   * @param {boolean} options.debug - When true, print http requests and responses to stdout
   *                                  Set this to 'true' from the constructor of your derived class
   */
  static initialize(port, { debug } = {}) {
    // `this` refers to the derived class
    this._fromInit = true
    this._obj = new this(port, { debug })

    this._obj.applyDebugRoutes()
    this._obj.applyRoutes()

    /* eslint-disable mocha/no-mocha-arrows */
    const name = this.constructor.name
    before(`starting mock ${name}`, () => this._obj.start())
    after(`stopping mock ${name}`, () => this._obj.stop())
    beforeEach(`resetting mock ${name}`, () => this._obj.reset())
  }

  /**
   * Starts the API on the configured port
   *
   * @return {Promise<void>}
   */
  async start() {
    return new Promise((resolve, reject) => {
      if (this.debug) {
        // eslint-disable-next-line no-console
        console.log('Starting mock on port', this.constructor.name, this.port)
      }
      this.server = this.app
        .listen(this.port, '127.0.0.1', err => {
          if (err) {
            return reject(err)
          }
          resolve()
        })
        .on('error', error => {
          // eslint-disable-next-line no-console
          console.error(
            'error starting mock:',
            this.constructor.name,
            error.message
          )
          process.exit(1)
        })
    })
  }

  /**
   * Returns the constructed object
   *
   * @return {AbstractMockApi}
   */
  static instance() {
    return this._obj
  }

  /**
   * Shuts down the API and waits for it to stop listening
   *
   * @return {Promise<void>}
   */
  async stop() {
    if (!this.server) return
    return new Promise((resolve, reject) => {
      if (this.debug) {
        // eslint-disable-next-line no-console
        console.log('Stopping mock', this.constructor.name)
      }
      this.server.close(err => {
        delete this.server
        if (err) {
          return reject(err)
        }
        resolve()
      })
    })
  }
}

export default AbstractMockApi
