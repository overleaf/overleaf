const AuthenticationManager = require('../../../../app/src/Features/Authentication/AuthenticationManager')
const Settings = require('settings-sharelatex')
const UserCreator = require('../../../../app/src/Features/User/UserCreator')
const UserGetter = require('../../../../app/src/Features/User/UserGetter')
const request = require('request-promise-native')

let globalUserNum = 1

module.exports = class UserHelper {
  constructor(user = null) {
    // used for constructing default emails, etc
    this.userNum = globalUserNum++
    // initialize all internal state properties to defaults
    this.reset()
    // set user if passed in, may be null
    this.user = user
  }

  /* sync functions */

  getDefaultEmail() {
    return `test.user.${this.userNum}@example.com`
  }

  getDefaultEmailPassword(userData = {}) {
    return {
      email: this.getDefaultEmail(),
      password: this.getDefaultPassword(this.userNum),
      ...userData
    }
  }

  getDefaultPassword() {
    return `new-password-${this.userNum}!`
  }

  reset() {
    // cached csrf token
    this._csrfToken = ''
    // used to store mongo user object once created/loaded
    this.user = null
    // cookie jar
    this.jar = request.jar()
    // initialize request instance with default options
    this.setRequestDefaults()
  }

  setRequestDefaults(defaults = {}) {
    // request-promise instance for making requests
    this.request = request.defaults({
      baseUrl: UserHelper.baseUrl(),
      followRedirect: false,
      jar: this.jar,
      resolveWithFullResponse: true,
      ...defaults
    })
  }

  /* async http api call methods */

  async getCsrfToken() {
    if (this._csrfToken) {
      return
    }
    // get csrf token from api and store
    const response = await this.request.get('/dev/csrf')
    this._csrfToken = response.body
    // use csrf token for requests
    this.setRequestDefaults({
      headers: { 'x-csrf-token': this._csrfToken }
    })
  }

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
    // clear out internal state
    this.reset()
    // resolve with http request response
    return response
  }

  /* static sync methods */

  static baseUrl() {
    return `http://${process.env['HTTP_TEST_HOST'] || 'localhost'}:3000`
  }

  /* static async instantiation methods */

  static async createUser(attributes = {}, options = {}) {
    const userHelper = new UserHelper()
    attributes = userHelper.getDefaultEmailPassword(attributes)
    // skip creating affiliations by default because it requires an
    // API call that will usually not be mocked in testing env
    if (attributes.skip_affiliation !== false) {
      attributes.skip_affiliation = true
    }
    // hash password and delete plaintext if set
    if (attributes.password) {
      attributes.hashedPassword = await AuthenticationManager.promises.hashPassword(
        attributes.password
      )
      delete attributes.password
    }

    userHelper.user = await UserCreator.promises.createNewUser(
      attributes,
      options
    )

    return userHelper
  }

  static async getUser(...args) {
    const user = await UserGetter.promises.getUser(...args)

    return new UserHelper(user)
  }

  static async loginUser(userData) {
    if (!userData.email || !userData.password) {
      throw new Error('email and password required')
    }
    const userHelper = new UserHelper()
    const loginPath = Settings.enableLegacyLogin ? '/login/legacy' : '/login'
    await userHelper.getCsrfToken()
    const response = await userHelper.request.post(loginPath, {
      json: userData
    })
    if (response.statusCode !== 200 || response.body.redir !== '/project') {
      throw new Error('login failed')
    }
    userHelper.user = await UserGetter.promises.getUser({
      email: userData.email
    })
    if (!userHelper.user) {
      throw new Error(`user not found for email: ${userData.email}`)
    }

    return userHelper
  }

  static async registerUser(userData, options = {}) {
    const userHelper = new UserHelper()
    await userHelper.getCsrfToken()
    userData = userHelper.getDefaultEmailPassword(userData)
    options.json = userData
    const { body } = await userHelper.request.post('/register', options)
    if (body.message && body.message.type === 'error') {
      throw new Error(`register api error: ${body.message.text}`)
    }
    userHelper.user = await UserGetter.promises.getUser({
      email: userData.email
    })
    if (!userHelper.user) {
      throw new Error(`user not found for email: ${userData.email}`)
    }

    return userHelper
  }
}
