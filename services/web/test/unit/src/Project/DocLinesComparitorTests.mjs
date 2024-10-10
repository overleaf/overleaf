import esmock from 'esmock'

const modulePath = '../../../../app/src/Features/Project/DocLinesComparitor.mjs'

describe('doc lines comparitor', function () {
  beforeEach(async function () {
    this.comparitor = await esmock.strict(modulePath, {})
  })

  it('should return true when the lines are the same', function () {
    const lines1 = ['hello', 'world']
    const lines2 = ['hello', 'world']
    const result = this.comparitor.areSame(lines1, lines2)
    result.should.equal(true)
  })
  ;[
    {
      lines1: ['hello', 'world'],
      lines2: ['diff', 'world'],
    },
    {
      lines1: ['hello', 'world'],
      lines2: ['hello', 'wrld'],
    },
  ].forEach(({ lines1, lines2 }) => {
    it('should return false when the lines are different', function () {
      const result = this.comparitor.areSame(lines1, lines2)
      result.should.equal(false)
    })
  })

  it('should return true when the lines are same', function () {
    const lines1 = ['hello', 'world']
    const lines2 = ['hello', 'world']
    const result = this.comparitor.areSame(lines1, lines2)
    result.should.equal(true)
  })

  it('should return false if the doc lines are different in length', function () {
    const lines1 = ['hello', 'world']
    const lines2 = ['hello', 'world', 'please']
    const result = this.comparitor.areSame(lines1, lines2)
    result.should.equal(false)
  })

  it('should return false if the first array is undefined', function () {
    const lines1 = undefined
    const lines2 = ['hello', 'world']
    const result = this.comparitor.areSame(lines1, lines2)
    result.should.equal(false)
  })

  it('should return false if the second array is undefined', function () {
    const lines1 = ['hello']
    const lines2 = undefined
    const result = this.comparitor.areSame(lines1, lines2)
    result.should.equal(false)
  })

  it('should return false if the second array is not an array', function () {
    const lines1 = ['hello']
    const lines2 = ''
    const result = this.comparitor.areSame(lines1, lines2)
    result.should.equal(false)
  })

  it('should return true when comparing equal orchard docs', function () {
    const lines1 = [{ text: 'hello world' }]
    const lines2 = [{ text: 'hello world' }]
    const result = this.comparitor.areSame(lines1, lines2)
    result.should.equal(true)
  })

  it('should return false when comparing different orchard docs', function () {
    const lines1 = [{ text: 'goodbye world' }]
    const lines2 = [{ text: 'hello world' }]
    const result = this.comparitor.areSame(lines1, lines2)
    result.should.equal(false)
  })
})
