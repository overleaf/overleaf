const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(sinonChai)
chai.use(chaiAsPromised)
const { expect } = chai
const recurly = require('recurly')
const modulePath = '../../../../app/src/Features/Subscription/RecurlyClient'
const SandboxedModule = require('sandboxed-module')

describe('RecurlyClient', function () {
  beforeEach(function () {
    this.settings = {
      apis: {
        recurly: {
          apiKey: 'nonsense',
          privateKey: 'private_nonsense',
        },
      },
    }

    this.user = { _id: '123456', email: 'joe@example.com', first_name: 'Joe' }
    this.recurlyAccount = new recurly.Account()
    Object.assign(this.recurlyAccount, { code: this.user._id })

    this.UserGetter = {
      promises: {
        getUser: sinon.stub().callsFake(userId => {
          if (userId === this.user._id) {
            return this.user
          }
        }),
      },
    }

    let client
    this.client = client = {
      getAccount: sinon.stub(),
    }
    this.recurly = {
      errors: recurly.errors,
      Client: function () {
        return client
      },
    }

    return (this.RecurlyClient = SandboxedModule.require(modulePath, {
      globals: {
        console: console,
      },
      requires: {
        'settings-sharelatex': this.settings,
        recurly: this.recurly,
        'logger-sharelatex': {
          err: sinon.stub(),
          error: sinon.stub(),
          warn: sinon.stub(),
          log: sinon.stub(),
          debug: sinon.stub(),
        },
        '../User/UserGetter': this.UserGetter,
      },
    }))
  })

  describe('initalizing recurly client with undefined API key parameter', function () {
    it('should create a client without error', function () {
      let testClient
      expect(() => {
        testClient = new recurly.Client(undefined)
      }).to.not.throw()
      expect(testClient).to.be.instanceOf(recurly.Client)
    })
  })

  describe('getAccountForUserId', function () {
    it('should return an Account if one exists', async function () {
      this.client.getAccount = sinon.stub().resolves(this.recurlyAccount)
      await expect(
        this.RecurlyClient.promises.getAccountForUserId(this.user._id)
      )
        .to.eventually.be.an.instanceOf(recurly.Account)
        .that.has.property('code', this.user._id)
    })

    it('should return nothing if no account found', async function () {
      this.client.getAccount = sinon
        .stub()
        .throws(new recurly.errors.NotFoundError())
      expect(
        this.RecurlyClient.promises.getAccountForUserId('nonsense')
      ).to.eventually.equal(undefined)
    })

    it('should re-throw caught errors', async function () {
      this.client.getAccount = sinon.stub().throws()
      await expect(
        this.RecurlyClient.promises.getAccountForUserId(this.user._id)
      ).to.eventually.be.rejectedWith(Error)
    })
  })

  describe('createAccountForUserId', function () {
    it('should return the Account as created by recurly', async function () {
      this.client.createAccount = sinon.stub().resolves(this.recurlyAccount)
      await expect(
        this.RecurlyClient.promises.createAccountForUserId(this.user._id)
      )
        .to.eventually.be.an.instanceOf(recurly.Account)
        .that.has.property('code', this.user._id)
    })

    it('should throw any API errors', async function () {
      this.client.createAccount = sinon.stub().throws()
      await expect(
        this.RecurlyClient.promises.createAccountForUserId(this.user._id)
      ).to.eventually.be.rejectedWith(Error)
    })
  })
})
