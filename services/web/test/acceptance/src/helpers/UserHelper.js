const { expect } = require('chai')
const AuthenticationManager = require('../../../../app/src/Features/Authentication/AuthenticationManager')
const Settings = require('settings-sharelatex')
const UserCreator = require('../../../../app/src/Features/User/UserCreator')
const UserGetter = require('../../../../app/src/Features/User/UserGetter')
const UserUpdater = require('../../../../app/src/Features/User/UserUpdater')
const moment = require('moment')
const request = require('request-promise-native')
const { db } = require('../../../../app/src/infrastructure/mongodb')
const { ObjectId } = require('mongodb')

let globalUserNum = 1

class UserHelper {
  /**
   * Create UserHelper
   * @param {object} [user] - Mongo User object
   */
  constructor(user = null) {
    // used for constructing default emails, etc
    this.userNum = globalUserNum++
    // initialize all internal state properties to defaults
    this.reset()
    // set user if passed in, may be null
    this.user = user
  }

  /* sync functions */

  /**
   * Get auditLog, ignore the login
   * @return {object[]}
   */
  getAuditLogWithoutNoise() {
    return (this.user.auditLog || []).filter(entry => {
      return entry.operation !== 'login'
    })
  }

  /**
   * Generate default email from unique (per instantiation) user number
   * @returns {string} email
   */
  getDefaultEmail() {
    return `test.user.${this.userNum}@example.com`
  }

  /**
   * Generate email, password args object. Default values will be used if
   * email and password are not passed in args.
   * @param {object} [userData]
   * @param {string} [userData.email] email to use
   * @param {string} [userData.password] password to use
   * @returns {object} email, password object
   */
  getDefaultEmailPassword(userData = {}) {
    return {
      email: this.getDefaultEmail(),
      password: this.getDefaultPassword(),
      ...userData,
    }
  }

  /**
   * Generate default password from unique (per instantiation) user number
   * @returns {string} password
   */
  getDefaultPassword() {
    return `New-Password-${this.userNum}!`
  }

  /**
   * (Re)set internal state of UserHelper object.
   */
  reset() {
    // cached csrf token
    this._csrfToken = ''
    // used to store mongo user object once created/loaded
    this.user = null
    // cookie jar
    this.jar = request.jar()
    // create new request instance
    this.request = request.defaults({})
    // initialize request instance with default options
    this.setRequestDefaults({
      baseUrl: UserHelper.baseUrl(),
      followRedirect: false,
      jar: this.jar,
      resolveWithFullResponse: true,
    })
  }

  /* Set defaults for request object. Applied over existing defaults.
   * @param {object} [defaults]
   */
  setRequestDefaults(defaults = {}) {
    // request-promise instance for making requests
    this.request = this.request.defaults(defaults)
  }

  /**
   * Make a request for the user and run expectations on the response.
   * @param {object} [requestOptions] options to pass to request
   * @param {object} [responseExpectations] expectations:
   *   - {Int} statusCode the expected status code
   *   - {RegEx} message a matcher for the message
   */
  async expectErrorOnRequest(requestOptions, responseExpectations) {
    let error
    try {
      await this.request(requestOptions)
    } catch (e) {
      error = e
    }
    expect(error).to.exist
    expect(error.statusCode).to.equal(responseExpectations.statusCode)
    expect(error.message).to.match(responseExpectations.message)
  }

  /* async http api call methods */

  /**
   * Requests csrf token unless already cached in internal state
   */
  async getCsrfToken() {
    // get csrf token from api and store
    const response = await this.request.get('/dev/csrf')
    this._csrfToken = response.body
    // use csrf token for requests
    this.setRequestDefaults({
      headers: { 'x-csrf-token': this._csrfToken },
    })
  }

  /**
   * Make request to POST /logout
   * @param {object} [options] options to pass to request
   * @returns {object} http response
   */
  async logout(options = {}) {
    // do not throw exception on 302
    options.simple = false
    // post logout
    const response = await this.request.post('/logout', options)
    if (
      response.statusCode !== 302 ||
      !response.headers.location.includes('/login')
    ) {
      throw new Error('logout failed')
    }
    // after logout CSRF token becomes invalid
    this._csrfToken = ''
    // resolve with http request response
    return response
  }

  /* static sync methods */

  /**
   * Generates base URL from env options
   * @returns {string} baseUrl
   */
  static baseUrl() {
    return `http://${process.env.HTTP_TEST_HOST || 'localhost'}:3000`
  }

  /* static async instantiation methods */

  /**
   * Create a new user via UserCreator and return UserHelper instance
   * @param {object} attributes user data for UserCreator
   * @param {object} options options for UserCreator
   * @returns {UserHelper}
   */
  static async createUser(attributes = {}) {
    const userHelper = new UserHelper()
    attributes = userHelper.getDefaultEmailPassword(attributes)

    // hash password and delete plaintext if set
    if (attributes.password) {
      attributes.hashedPassword = await AuthenticationManager.promises.hashPassword(
        attributes.password
      )
      delete attributes.password
    }

    userHelper.user = await UserCreator.promises.createNewUser(attributes)

    return userHelper
  }

  /**
   * Get existing user via UserGetter and return UserHelper instance.
   * All args passed to UserGetter.getUser.
   * @returns {UserHelper}
   */
  static async getUser(...args) {
    const user = await UserGetter.promises.getUser(...args)

    if (!user) {
      throw new Error(`no user found for args: ${JSON.stringify([...args])}`)
    }

    return new UserHelper(user)
  }

  /**
   * Update an existing user via UserUpdater and return the updated UserHelper
   * instance.
   * All args passed to UserUpdater.getUser.
   * @returns {UserHelper}
   */
  static async updateUser(userId, update) {
    // TODO(das7pad): revert back to args pass-through after mongo upgrades
    const user = await UserUpdater.promises.updateUser(
      { _id: ObjectId(userId) },
      update
    )

    if (!user) {
      throw new Error(`no user found for args: ${JSON.stringify([userId])}`)
    }

    return new UserHelper(user)
  }

  /**
   * Login to existing account via request and return UserHelper instance
   * @param {object} userData
   * @param {string} userData.email
   * @param {string} userData.password
   * @returns {UserHelper}
   */
  static async loginUser(userData) {
    if (!userData || !userData.email || !userData.password) {
      throw new Error('email and password required')
    }
    const userHelper = new UserHelper()
    const loginPath = Settings.enableLegacyLogin ? '/login/legacy' : '/login'
    await userHelper.getCsrfToken()
    const response = await userHelper.request.post(loginPath, {
      json: userData,
    })
    if (response.statusCode !== 200 || response.body.redir !== '/project') {
      const error = new Error('login failed')
      error.response = response
      throw error
    }
    userHelper.user = await UserGetter.promises.getUser({
      email: userData.email,
    })
    if (!userHelper.user) {
      throw new Error(`user not found for email: ${userData.email}`)
    }
    await userHelper.getCsrfToken()

    return userHelper
  }

  /**
   * Check if user is logged in by requesting an endpoint behind authentication.
   * @returns {Boolean}
   */
  async isLoggedIn() {
    const response = await this.request.get('/user/sessions', {
      followRedirect: true,
    })
    return response.request.path === '/user/sessions'
  }

  /**
   * Register new account via request and return UserHelper instance.
   * If userData is not provided the default email and password will be used.
   * @param {object} [userData]
   * @param {string} [userData.email]
   * @param {string} [userData.password]
   * @returns {UserHelper}
   */
  static async registerUser(userData, options = {}) {
    const userHelper = new UserHelper()
    await userHelper.getCsrfToken()
    userData = userHelper.getDefaultEmailPassword(userData)
    options.json = userData
    const { body } = await userHelper.request.post('/register', options)
    if (body.message && body.message.type === 'error') {
      throw new Error(`register api error: ${body.message.text}`)
    }
    if (body.redir === '/institutional-login') {
      throw new Error(
        `cannot register intitutional email: ${options.json.email}`
      )
    }
    userHelper.user = await UserGetter.promises.getUser({
      email: userData.email,
    })
    if (!userHelper.user) {
      throw new Error(`user not found for email: ${userData.email}`)
    }
    await userHelper.getCsrfToken()

    return userHelper
  }

  async refreshMongoUser() {
    this.user = await UserGetter.promises.getUser({
      _id: this.user._id,
    })
    return this.user
  }

  async addEmail(email) {
    const response = await this.request.post({
      form: {
        email,
      },
      simple: false,
      uri: '/user/emails',
    })
    expect(response.statusCode).to.equal(204)
  }

  async addEmailAndConfirm(userId, email) {
    await this.addEmail(email)
    await this.confirmEmail(userId, email)
  }

  async backdateConfirmation(userId, email, days) {
    const confirmedDate = moment().subtract(days, 'days').toDate()
    const query = {
      _id: userId,
      'emails.email': email,
    }
    const update = {
      $set: {
        'emails.$.confirmedAt': confirmedDate,
        'emails.$.reconfirmedAt': confirmedDate,
      },
    }
    await UserUpdater.promises.updateUser(query, update)
  }

  async confirmEmail(userId, email) {
    let response
    // UserHelper.createUser does not create a confirmation token
    response = await this.request.post({
      form: {
        email,
      },
      simple: false,
      uri: '/user/emails/resend_confirmation',
    })
    expect(response.statusCode).to.equal(200)
    const tokenData = await db.tokens
      .find({
        use: 'email_confirmation',
        'data.user_id': userId.toString(),
        'data.email': email,
        usedAt: { $exists: false },
      })
      .next()
    response = await this.request.post({
      form: {
        token: tokenData.token,
      },
      simple: false,
      uri: '/user/emails/confirm',
    })
    expect(response.statusCode).to.equal(200)
  }
}

module.exports = UserHelper
