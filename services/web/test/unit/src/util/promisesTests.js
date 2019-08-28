const { expect } = require('chai')
const { promisifyAll } = require('../../../../app/src/util/promises')

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
})
