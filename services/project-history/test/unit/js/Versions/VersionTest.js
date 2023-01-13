/* eslint-disable
    no-return-assign,
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import { expect } from 'chai'
import { strict as esmock } from 'esmock'

const MODULE_PATH = '../../../../app/js/Versions.js'

describe('Versions', function () {
  beforeEach(async function () {
    return (this.Versions = await esmock(MODULE_PATH))
  })

  describe('compare', function () {
    describe('for greater major version', function () {
      return it('should return +1', function () {
        return this.Versions.compare('2.1', '1.1').should.equal(+1)
      })
    })

    describe('for lesser major version', function () {
      return it('should return -1', function () {
        return this.Versions.compare('1.1', '2.1').should.equal(-1)
      })
    })

    describe('for equal major versions with no minor version', function () {
      return it('should return 0', function () {
        return this.Versions.compare('2', '2').should.equal(0)
      })
    })

    describe('for equal major versions with greater minor version', function () {
      return it('should return +1', function () {
        return this.Versions.compare('2.3', '2.1').should.equal(+1)
      })
    })

    describe('for equal major versions with lesser minor version', function () {
      return it('should return -1', function () {
        return this.Versions.compare('2.1', '2.3').should.equal(-1)
      })
    })

    describe('for equal major versions with greater minor version (non lexical)', function () {
      return it('should return +1', function () {
        return this.Versions.compare('2.10', '2.9').should.equal(+1)
      })
    })

    describe('for equal major versions with lesser minor version (non lexical)', function () {
      return it('should return +1', function () {
        return this.Versions.compare('2.9', '2.10').should.equal(-1)
      })
    })

    describe('for a single major version vs a major+minor version', function () {
      return it('should return +1', function () {
        return this.Versions.compare('2.1', '1').should.equal(+1)
      })
    })

    describe('for a major+minor version vs a single major version', function () {
      return it('should return -1', function () {
        return this.Versions.compare('1', '2.1').should.equal(-1)
      })
    })

    describe('for equal major versions with greater minor version vs zero', function () {
      return it('should return +1', function () {
        return this.Versions.compare('2.3', '2.0').should.equal(+1)
      })
    })

    return describe('for equal major versions with lesser minor version of zero', function () {
      return it('should return -1', function () {
        return this.Versions.compare('2.0', '2.3').should.equal(-1)
      })
    })
  })

  describe('gt', function () {
    describe('for greater major version', function () {
      return it('should return true', function () {
        return this.Versions.gt('2.1', '1.1').should.equal(true)
      })
    })

    describe('for lesser major version', function () {
      return it('should return false', function () {
        return this.Versions.gt('1.1', '2.1').should.equal(false)
      })
    })

    return describe('for equal major versions with no minor version', function () {
      return it('should return false', function () {
        return this.Versions.gt('2', '2').should.equal(false)
      })
    })
  })

  describe('gte', function () {
    describe('for greater major version', function () {
      return it('should return true', function () {
        return this.Versions.gte('2.1', '1.1').should.equal(true)
      })
    })

    describe('for lesser major version', function () {
      return it('should return false', function () {
        return this.Versions.gte('1.1', '2.1').should.equal(false)
      })
    })

    return describe('for equal major versions with no minor version', function () {
      return it('should return true', function () {
        return this.Versions.gte('2', '2').should.equal(true)
      })
    })
  })

  describe('lt', function () {
    describe('for greater major version', function () {
      return it('should return false', function () {
        return this.Versions.lt('2.1', '1.1').should.equal(false)
      })
    })

    describe('for lesser major version', function () {
      return it('should return true', function () {
        return this.Versions.lt('1.1', '2.1').should.equal(true)
      })
    })

    return describe('for equal major versions with no minor version', function () {
      return it('should return false', function () {
        return this.Versions.lt('2', '2').should.equal(false)
      })
    })
  })

  return describe('lte', function () {
    describe('for greater major version', function () {
      return it('should return false', function () {
        return this.Versions.lte('2.1', '1.1').should.equal(false)
      })
    })

    describe('for lesser major version', function () {
      return it('should return true', function () {
        return this.Versions.lte('1.1', '2.1').should.equal(true)
      })
    })

    return describe('for equal major versions with no minor version', function () {
      return it('should return true', function () {
        return this.Versions.lte('2', '2').should.equal(true)
      })
    })
  })
})
