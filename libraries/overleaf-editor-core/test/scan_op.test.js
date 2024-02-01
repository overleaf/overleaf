// @ts-check
const { expect } = require('chai')
const {
  RetainOp,
  ScanOp,
  InsertOp,
  RemoveOp,
} = require('../lib/operation/scan_op')
const { UnprocessableError, ApplyError } = require('../lib/errors')

describe('ScanOp', function () {
  describe('fromJSON', function () {
    it('constructs a RetainOp from object', function () {
      const op = ScanOp.fromJSON({ r: 1 })
      expect(op).to.be.instanceOf(RetainOp)
      expect(/** @type {RetainOp} */ (op).length).to.equal(1)
    })

    it('constructs a RetainOp from number', function () {
      const op = ScanOp.fromJSON(2)
      expect(op).to.be.instanceOf(RetainOp)
      expect(/** @type {RetainOp} */ (op).length).to.equal(2)
    })

    it('constructs an InsertOp from string', function () {
      const op = ScanOp.fromJSON('abc')
      expect(op).to.be.instanceOf(InsertOp)
      expect(/** @type {InsertOp} */ (op).insertion).to.equal('abc')
    })

    it('constructs an InsertOp from object', function () {
      const op = ScanOp.fromJSON({ i: 'abc' })
      expect(op).to.be.instanceOf(InsertOp)
      expect(/** @type {InsertOp} */ (op).insertion).to.equal('abc')
    })

    it('constructs a RemoveOp from number', function () {
      const op = ScanOp.fromJSON(-2)
      expect(op).to.be.instanceOf(RemoveOp)
      expect(/** @type {RemoveOp} */ (op).length).to.equal(2)
    })

    it('throws an error for invalid input', function () {
      expect(() => ScanOp.fromJSON({})).to.throw(UnprocessableError)
    })

    it('throws an error for zero', function () {
      expect(() => ScanOp.fromJSON(0)).to.throw(UnprocessableError)
    })
  })
})

describe('RetainOp', function () {
  it('is equal to another RetainOp with the same length', function () {
    const op1 = new RetainOp(1)
    const op2 = new RetainOp(1)
    expect(op1.equals(op2)).to.be.true
  })

  it('is not equal to another RetainOp with a different length', function () {
    const op1 = new RetainOp(1)
    const op2 = new RetainOp(2)
    expect(op1.equals(op2)).to.be.false
  })

  it('is not equal to an InsertOp', function () {
    const op1 = new RetainOp(1)
    const op2 = new InsertOp('a')
    expect(op1.equals(op2)).to.be.false
  })

  it('is not equal to a RemoveOp', function () {
    const op1 = new RetainOp(1)
    const op2 = new RemoveOp(1)
    expect(op1.equals(op2)).to.be.false
  })

  it('can merge with another RetainOp', function () {
    const op1 = new RetainOp(1)
    const op2 = new RetainOp(2)
    expect(op1.canMergeWith(op2)).to.be.true
    op1.mergeWith(op2)
    expect(op1.equals(new RetainOp(3))).to.be.true
  })

  it('cannot merge with an InsertOp', function () {
    const op1 = new RetainOp(1)
    const op2 = new InsertOp('a')
    expect(op1.canMergeWith(op2)).to.be.false
    expect(() => op1.mergeWith(op2)).to.throw(Error)
  })

  it('cannot merge with a RemoveOp', function () {
    const op1 = new RetainOp(1)
    const op2 = new RemoveOp(1)
    expect(op1.canMergeWith(op2)).to.be.false
    expect(() => op1.mergeWith(op2)).to.throw(Error)
  })

  it('can be converted to JSON', function () {
    const op = new RetainOp(3)
    expect(op.toJSON()).to.equal(3)
  })

  it('adds to the length and cursor when applied to length', function () {
    const op = new RetainOp(3)
    const { length, inputCursor } = op.applyToLength({
      length: 10,
      inputCursor: 10,
      inputLength: 30,
    })
    expect(length).to.equal(13)
    expect(inputCursor).to.equal(13)
  })

  it('adds from the input to the result when applied', function () {
    const op = new RetainOp(3)
    const { result, inputCursor } = op.apply('abcdefghi', {
      result: 'xyz',
      inputCursor: 3,
    })
    expect(result).to.equal('xyzdef')
    expect(inputCursor).to.equal(6)
  })
})

describe('InsertOp', function () {
  it('is equal to another InsertOp with the same insertion', function () {
    const op1 = new InsertOp('a')
    const op2 = new InsertOp('a')
    expect(op1.equals(op2)).to.be.true
  })

  it('is not equal to another InsertOp with a different insertion', function () {
    const op1 = new InsertOp('a')
    const op2 = new InsertOp('b')
    expect(op1.equals(op2)).to.be.false
  })

  it('is not equal to a RetainOp', function () {
    const op1 = new InsertOp('a')
    const op2 = new RetainOp(1)
    expect(op1.equals(op2)).to.be.false
  })

  it('is not equal to a RemoveOp', function () {
    const op1 = new InsertOp('a')
    const op2 = new RemoveOp(1)
    expect(op1.equals(op2)).to.be.false
  })

  it('can merge with another InsertOp', function () {
    const op1 = new InsertOp('a')
    const op2 = new InsertOp('b')
    expect(op1.canMergeWith(op2)).to.be.true
    op1.mergeWith(op2)
    expect(op1.equals(new InsertOp('ab'))).to.be.true
  })

  it('cannot merge with a RetainOp', function () {
    const op1 = new InsertOp('a')
    const op2 = new RetainOp(1)
    expect(op1.canMergeWith(op2)).to.be.false
    expect(() => op1.mergeWith(op2)).to.throw(Error)
  })

  it('cannot merge with a RemoveOp', function () {
    const op1 = new InsertOp('a')
    const op2 = new RemoveOp(1)
    expect(op1.canMergeWith(op2)).to.be.false
    expect(() => op1.mergeWith(op2)).to.throw(Error)
  })

  it('can be converted to JSON', function () {
    const op = new InsertOp('a')
    expect(op.toJSON()).to.equal('a')
  })

  it('adds to the length when applied to length', function () {
    const op = new InsertOp('abc')
    const { length, inputCursor } = op.applyToLength({
      length: 10,
      inputCursor: 20,
      inputLength: 40,
    })
    expect(length).to.equal(13)
    expect(inputCursor).to.equal(20)
  })

  it('adds from the insertion to the result when applied', function () {
    const op = new InsertOp('ghi')
    const { result, inputCursor } = op.apply('abcdef', {
      result: 'xyz',
      inputCursor: 3,
    })
    expect(result).to.equal('xyzghi')
    expect(inputCursor).to.equal(3)
  })

  it('can apply a retain of the rest of the input', function () {
    const op = new RetainOp(10)
    const { length, inputCursor } = op.applyToLength({
      length: 10,
      inputCursor: 5,
      inputLength: 15,
    })
    expect(length).to.equal(20)
    expect(inputCursor).to.equal(15)
  })

  it('cannot apply to length if the input cursor is at the end', function () {
    const op = new RetainOp(10)
    expect(() =>
      op.applyToLength({
        length: 10,
        inputCursor: 10,
        inputLength: 10,
      })
    ).to.throw(ApplyError)
  })
})

describe('RemoveOp', function () {
  it('is equal to another RemoveOp with the same length', function () {
    const op1 = new RemoveOp(1)
    const op2 = new RemoveOp(1)
    expect(op1.equals(op2)).to.be.true
  })

  it('is not equal to another RemoveOp with a different length', function () {
    const op1 = new RemoveOp(1)
    const op2 = new RemoveOp(2)
    expect(op1.equals(op2)).to.be.false
  })

  it('is not equal to a RetainOp', function () {
    const op1 = new RemoveOp(1)
    const op2 = new RetainOp(1)
    expect(op1.equals(op2)).to.be.false
  })

  it('is not equal to an InsertOp', function () {
    const op1 = new RemoveOp(1)
    const op2 = new InsertOp('a')
    expect(op1.equals(op2)).to.be.false
  })

  it('can merge with another RemoveOp', function () {
    const op1 = new RemoveOp(1)
    const op2 = new RemoveOp(2)
    expect(op1.canMergeWith(op2)).to.be.true
    op1.mergeWith(op2)
    expect(op1.equals(new RemoveOp(3))).to.be.true
  })

  it('cannot merge with a RetainOp', function () {
    const op1 = new RemoveOp(1)
    const op2 = new RetainOp(1)
    expect(op1.canMergeWith(op2)).to.be.false
    expect(() => op1.mergeWith(op2)).to.throw(Error)
  })

  it('cannot merge with an InsertOp', function () {
    const op1 = new RemoveOp(1)
    const op2 = new InsertOp('a')
    expect(op1.canMergeWith(op2)).to.be.false
    expect(() => op1.mergeWith(op2)).to.throw(Error)
  })

  it('can be converted to JSON', function () {
    const op = new RemoveOp(3)
    expect(op.toJSON()).to.equal(-3)
  })

  it('adds to the input cursor when applied to length', function () {
    const op = new RemoveOp(3)
    const { length, inputCursor } = op.applyToLength({
      length: 10,
      inputCursor: 10,
      inputLength: 30,
    })
    expect(length).to.equal(10)
    expect(inputCursor).to.equal(13)
  })

  it('does not change the result and adds to the cursor when applied', function () {
    const op = new RemoveOp(3)
    const { result, inputCursor } = op.apply('abcdefghi', {
      result: 'xyz',
      inputCursor: 3,
    })
    expect(result).to.equal('xyz')
    expect(inputCursor).to.equal(6)
  })
})
