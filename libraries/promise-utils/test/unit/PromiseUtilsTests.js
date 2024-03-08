const { expect } = require('chai')
const {
  promisifyAll,
  promisifyClass,
  callbackifyMultiResult,
  callbackifyClass,
  callbackifyAll,
  expressify,
  expressifyErrorHandler,
} = require('../..')

describe('promisifyAll', function () {
  describe('basic functionality', function () {
    before(function () {
      this.module = {
        SOME_CONSTANT: 1,
        asyncAdd(a, b, callback) {
          callback(null, a + b)
        },
        asyncDouble(x, callback) {
          this.asyncAdd(x, x, callback)
        },
      }
      this.promisified = promisifyAll(this.module)
    })

    it('promisifies functions in the module', async function () {
      const sum = await this.promisified.asyncAdd(29, 33)
      expect(sum).to.equal(62)
    })

    it('binds this to the original module', async function () {
      const sum = await this.promisified.asyncDouble(38)
      expect(sum).to.equal(76)
    })

    it('does not copy over non-functions', async function () {
      expect(this.promisified).not.to.have.property('SOME_CONSTANT')
    })

    it('does not modify the prototype of the module', async function () {
      expect(this.promisified.toString()).to.equal('[object Object]')
    })
  })

  describe('without option', function () {
    before(function () {
      this.module = {
        asyncAdd(a, b, callback) {
          callback(null, a + b)
        },
        syncAdd(a, b) {
          return a + b
        },
      }
      this.promisified = promisifyAll(this.module, { without: ['syncAdd'] })
    })

    it('does not promisify excluded functions', function () {
      expect(this.promisified.syncAdd).not.to.exist
    })

    it('promisifies other functions', async function () {
      const sum = await this.promisified.asyncAdd(12, 89)
      expect(sum).to.equal(101)
    })
  })

  describe('multiResult option', function () {
    before(function () {
      this.module = {
        asyncAdd(a, b, callback) {
          callback(null, a + b)
        },
        asyncArithmetic(a, b, callback) {
          callback(null, a + b, a * b)
        },
      }
      this.promisified = promisifyAll(this.module, {
        multiResult: { asyncArithmetic: ['sum', 'product'] },
      })
    })

    it('promisifies multi-result functions', async function () {
      const result = await this.promisified.asyncArithmetic(3, 6)
      expect(result).to.deep.equal({ sum: 9, product: 18 })
    })

    it('promisifies other functions normally', async function () {
      const sum = await this.promisified.asyncAdd(6, 1)
      expect(sum).to.equal(7)
    })
  })
})

describe('promisifyClass', function () {
  describe('basic functionality', function () {
    before(function () {
      this.Class = class {
        constructor(a) {
          this.a = a
        }

        asyncAdd(b, callback) {
          callback(null, this.a + b)
        }
      }
      this.Promisified = promisifyClass(this.Class)
    })

    it('promisifies the class methods', async function () {
      const adder = new this.Promisified(1)
      const sum = await adder.asyncAdd(2)
      expect(sum).to.equal(3)
    })
  })

  describe('without option', function () {
    before(function () {
      this.Class = class {
        constructor(a) {
          this.a = a
        }

        asyncAdd(b, callback) {
          callback(null, this.a + b)
        }

        syncAdd(b) {
          return this.a + b
        }
      }
      this.Promisified = promisifyClass(this.Class, { without: ['syncAdd'] })
    })

    it('does not promisify excluded functions', function () {
      const adder = new this.Promisified(10)
      const sum = adder.syncAdd(12)
      expect(sum).to.equal(22)
    })

    it('promisifies other functions', async function () {
      const adder = new this.Promisified(23)
      const sum = await adder.asyncAdd(3)
      expect(sum).to.equal(26)
    })
  })

  describe('multiResult option', function () {
    before(function () {
      this.Class = class {
        constructor(a) {
          this.a = a
        }

        asyncAdd(b, callback) {
          callback(null, this.a + b)
        }

        asyncArithmetic(b, callback) {
          callback(null, this.a + b, this.a * b)
        }
      }
      this.Promisified = promisifyClass(this.Class, {
        multiResult: { asyncArithmetic: ['sum', 'product'] },
      })
    })

    it('promisifies multi-result functions', async function () {
      const adder = new this.Promisified(3)
      const result = await adder.asyncArithmetic(6)
      expect(result).to.deep.equal({ sum: 9, product: 18 })
    })

    it('promisifies other functions normally', async function () {
      const adder = new this.Promisified(6)
      const sum = await adder.asyncAdd(1)
      expect(sum).to.equal(7)
    })
  })
})

describe('callbackifyMultiResult', function () {
  it('callbackifies a multi-result function', function (done) {
    async function asyncArithmetic(a, b) {
      return { sum: a + b, product: a * b }
    }
    const callbackified = callbackifyMultiResult(asyncArithmetic, [
      'sum',
      'product',
    ])
    callbackified(3, 11, (err, sum, product) => {
      if (err != null) {
        return done(err)
      }
      expect(sum).to.equal(14)
      expect(product).to.equal(33)
      done()
    })
  })

  it('propagates errors', function (done) {
    async function asyncBomb() {
      throw new Error('BOOM!')
    }
    const callbackified = callbackifyMultiResult(asyncBomb, [
      'explosives',
      'dynamite',
    ])
    callbackified(err => {
      expect(err).to.exist
      done()
    })
  })
})

describe('callbackifyAll', function () {
  describe('basic functionality', function () {
    before(function () {
      this.module = {
        SOME_CONSTANT: 1,
        async asyncAdd(a, b) {
          return a + b
        },
        async asyncDouble(x, callback) {
          return await this.asyncAdd(x, x)
        },
        dashConcat(a, b) {
          return `${a}-${b}`
        },
      }
      this.callbackified = callbackifyAll(this.module)
    })

    it('callbackifies async functions in the module', function (done) {
      this.callbackified.asyncAdd(77, 18, (err, sum) => {
        if (err) {
          return done(err)
        }
        expect(sum).to.equal(95)
        done()
      })
    })

    it('binds this to the original module', function (done) {
      this.callbackified.asyncDouble(20, (err, double) => {
        if (err) {
          return done(err)
        }
        expect(double).to.equal(40)
        done()
      })
    })

    it('copies over regular functions', function () {
      const s = this.callbackified.dashConcat('ping', 'pong')
      expect(s).to.equal('ping-pong')
    })

    it('copies over non-functions', function () {
      expect(this.callbackified.SOME_CONSTANT).to.equal(1)
    })
  })

  describe('multiResult option', function () {
    before(function () {
      this.module = {
        async asyncAdd(a, b) {
          return a + b
        },
        async asyncArithmetic(a, b) {
          return { sum: a + b, product: a * b }
        },
      }
      this.callbackified = callbackifyAll(this.module, {
        multiResult: { asyncArithmetic: ['sum', 'product'] },
      })
    })

    it('callbackifies multi-result functions', function (done) {
      this.callbackified.asyncArithmetic(4, 5, (err, sum, product) => {
        if (err) {
          return done(err)
        }
        expect(sum).to.equal(9)
        expect(product).to.equal(20)
        done()
      })
    })

    it('callbackifies other functions normally', function (done) {
      this.callbackified.asyncAdd(77, 18, (err, sum) => {
        if (err) {
          return done(err)
        }
        expect(sum).to.equal(95)
        done()
      })
    })
  })

  describe('without option', function () {
    before(function () {
      this.module = {
        async asyncAdd(a, b) {
          return a + b
        },
        async asyncArithmetic(a, b) {
          return { sum: a + b, product: a * b }
        },
      }
      this.callbackified = callbackifyAll(this.module, {
        without: ['asyncAdd'],
      })
    })

    it('does not callbackify excluded functions', function () {
      expect(this.callbackified.asyncAdd).not.to.exist
    })

    it('callbackifies other functions', async function () {
      this.callbackified.asyncArithmetic(5, 6, (err, { sum, product }) => {
        expect(err).not.to.exist
        expect(sum).to.equal(11)
        expect(product).to.equal(30)
      })
    })
  })
})

describe('callbackifyClass', function () {
  describe('basic functionality', function () {
    before(function () {
      this.Class = class {
        constructor(a) {
          this.a = a
        }

        async asyncAdd(b) {
          return this.a + b
        }
      }
      this.Callbackified = callbackifyClass(this.Class)
    })

    it('callbackifies the class methods', function (done) {
      const adder = new this.Callbackified(1)
      adder.asyncAdd(2, (err, sum) => {
        expect(err).not.to.exist
        expect(sum).to.equal(3)
        done()
      })
    })
  })

  describe('without option', function () {
    before(function () {
      this.Class = class {
        constructor(a) {
          this.a = a
        }

        async asyncAdd(b) {
          return this.a + b
        }

        syncAdd(b) {
          return this.a + b
        }
      }
      this.Callbackified = callbackifyClass(this.Class, {
        without: ['syncAdd'],
      })
    })

    it('does not callbackify excluded functions', function () {
      const adder = new this.Callbackified(10)
      const sum = adder.syncAdd(12)
      expect(sum).to.equal(22)
    })

    it('callbackifies other functions', function (done) {
      const adder = new this.Callbackified(1)
      adder.asyncAdd(2, (err, sum) => {
        expect(err).not.to.exist
        expect(sum).to.equal(3)
        done()
      })
    })
  })

  describe('multiResult option', function () {
    before(function () {
      this.Class = class {
        constructor(a) {
          this.a = a
        }

        async asyncAdd(b) {
          return this.a + b
        }

        async asyncArithmetic(b) {
          return { sum: this.a + b, product: this.a * b }
        }
      }
      this.Callbackified = callbackifyClass(this.Class, {
        multiResult: { asyncArithmetic: ['sum', 'product'] },
      })
    })

    it('callbackifies multi-result functions', function (done) {
      const adder = new this.Callbackified(3)
      adder.asyncArithmetic(6, (err, sum, product) => {
        expect(err).not.to.exist
        expect(sum).to.equal(9)
        expect(product).to.equal(18)
        done()
      })
    })

    it('callbackifies other functions normally', function (done) {
      const adder = new this.Callbackified(6)
      adder.asyncAdd(2, (err, sum) => {
        expect(err).not.to.exist
        expect(sum).to.equal(8)
        done()
      })
    })
  })
})

describe('expressify', function () {
  it('should propagate any rejection to the "next" callback', function (done) {
    const fn = () => Promise.reject(new Error('rejected'))
    expressify(fn)({}, {}, error => {
      expect(error.message).to.equal('rejected')
      done()
    })
  })
})

describe('expressifyErrorHandler', function () {
  it('should propagate any rejection to the "next" callback', function (done) {
    const fn = () => Promise.reject(new Error('rejected'))
    expressifyErrorHandler(fn)({}, {}, {}, error => {
      expect(error.message).to.equal('rejected')
      done()
    })
  })
})
