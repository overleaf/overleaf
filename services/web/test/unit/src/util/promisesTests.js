const { expect } = require('chai')
const {
  promisifyAll,
  callbackifyMultiResult
} = require('../../../../app/src/util/promises')

describe('promisifyAll', function() {
  describe('basic functionality', function() {
    before(function() {
      this.module = {
        SOME_CONSTANT: 1,
        asyncAdd(a, b, callback) {
          callback(null, a + b)
        },
        asyncDouble(x, callback) {
          this.asyncAdd(x, x, callback)
        }
      }
      this.promisified = promisifyAll(this.module)
    })

    it('promisifies functions in the module', async function() {
      const sum = await this.promisified.asyncAdd(29, 33)
      expect(sum).to.equal(62)
    })

    it('binds this to the original module', async function() {
      const sum = await this.promisified.asyncDouble(38)
      expect(sum).to.equal(76)
    })

    it('does not copy over non-functions', async function() {
      expect(this.promisified).not.to.have.property('SOME_CONSTANT')
    })

    it('does not modify the prototype of the module', async function() {
      expect(this.promisified.toString()).to.equal('[object Object]')
    })
  })

  describe('without option', function() {
    before(function() {
      this.module = {
        asyncAdd(a, b, callback) {
          callback(null, a + b)
        },
        syncAdd(a, b) {
          return a + b
        }
      }
      this.promisified = promisifyAll(this.module, { without: 'syncAdd' })
    })

    it('does not promisify excluded functions', function() {
      expect(this.promisified.syncAdd).not.to.exist
    })

    it('promisifies other functions', async function() {
      const sum = await this.promisified.asyncAdd(12, 89)
      expect(sum).to.equal(101)
    })
  })

  describe('multiResult option', function() {
    before(function() {
      this.module = {
        asyncAdd(a, b, callback) {
          callback(null, a + b)
        },
        asyncArithmetic(a, b, callback) {
          callback(null, a + b, a * b)
        }
      }
      this.promisified = promisifyAll(this.module, {
        multiResult: { asyncArithmetic: ['sum', 'product'] }
      })
    })

    it('promisifies multi-result functions', async function() {
      const result = await this.promisified.asyncArithmetic(3, 6)
      expect(result).to.deep.equal({ sum: 9, product: 18 })
    })

    it('promisifies other functions normally', async function() {
      const sum = await this.promisified.asyncAdd(6, 1)
      expect(sum).to.equal(7)
    })
  })
})

describe('callbackifyMultiResult', function() {
  it('callbackifies a multi-result function', function(done) {
    async function asyncArithmetic(a, b) {
      return { sum: a + b, product: a * b }
    }
    const callbackified = callbackifyMultiResult(asyncArithmetic, [
      'sum',
      'product'
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

  it('propagates errors', function(done) {
    async function asyncBomb() {
      throw new Error('BOOM!')
    }
    const callbackified = callbackifyMultiResult(asyncBomb, [
      'explosives',
      'dynamite'
    ])
    callbackified(err => {
      expect(err).to.exist
      done()
    })
  })
})
