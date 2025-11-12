const { ObjectId } = require('mongodb-legacy')
const { expect } = require('chai')
const sinon = require('sinon')

describe('Mongo ObjectId comparison', function () {
  const ObjectId1 = new ObjectId('111111111111111111111111')
  const ObjectId2 = new ObjectId('65d8607441ef95170e89bd2a')
  const ObjectId1a = new ObjectId('111111111111111111111111')
  const ObjectId1b = new ObjectId('111111111111111111111111')

  const string1 = ObjectId1.toString()
  const string2 = ObjectId2.toString()
  const number1 = Number(ObjectId1)
  const repr1 = 'new ObjectId("111111111111111111111111")'

  describe('using chai', function () {
    describe('equal (===)', function () {
      it('object ids should equal themselves', function () {
        expect(ObjectId1).to.equal(ObjectId1)
        expect(ObjectId2).to.equal(ObjectId2)
      })
      it('different objects with the same id should not be equal', function () {
        expect(ObjectId1a).to.not.equal(ObjectId1b)
      })
      it('different object ids should not be equal', function () {
        expect(ObjectId1).to.not.equal(ObjectId2)
      })
      it('object id should not equal a string with the same id (left operand)', function () {
        expect(ObjectId1).to.not.equal(string1)
      })
      it('object id should not equal a string with the same id (right operand)', function () {
        expect(string1).to.not.equal(ObjectId1)
      })
      it('object id should not equal a string with a different id', function () {
        expect(ObjectId1).to.not.equal(string2)
      })
      it('object id should not equal a number with the same id (left operand)', function () {
        expect(ObjectId1).to.not.equal(number1)
      })
      it('object id should not equal a number with the same id (right operand)', function () {
        expect(number1).to.not.equal(ObjectId1)
      })
      it('object id should not equal the string representation with the same id (left operand)', function () {
        expect(ObjectId1).to.not.equal(repr1)
      })
      it('object id should not equal the string representation with the same id (right operand)', function () {
        expect(repr1).to.not.equal(ObjectId1)
      })
    })

    describe('deep equal', function () {
      it('object ids should deep equal themselves', function () {
        expect(ObjectId1).to.deep.equal(ObjectId1)
        expect(ObjectId2).to.deep.equal(ObjectId2)
      })
      it('different objects with the same id should be deep equal', function () {
        expect(ObjectId1a).to.deep.equal(ObjectId1b)
      })
      it('different object ids should not be deep equal', function () {
        expect(ObjectId1).to.not.deep.equal(ObjectId2)
      })
      it('object id should not deep equal a string with the same id (left operand)', function () {
        expect(ObjectId1).to.not.deep.equal(string1)
      })
      it('object id should not deep equal a string with the same id (right operand)', function () {
        expect(string1).to.not.deep.equal(ObjectId1)
      })
      it('object id should not deep equal a string with a different id', function () {
        expect(ObjectId1).to.not.deep.equal(string2)
      })
      it('object id should not deep equal a number with the same id (left operand)', function () {
        expect(ObjectId1).to.not.deep.equal(number1)
      })
      it('object id should not deep equal a number with the same id (right operand)', function () {
        expect(number1).to.not.deep.equal(ObjectId1)
      })
      it('object id should not deep equal the string representation with the same id (left operand)', function () {
        expect(ObjectId1).to.not.deep.equal(repr1)
      })
      it('object id should not deep equal the string representation with the same id (right operand)', function () {
        expect(repr1).to.not.deep.equal(ObjectId1)
      })
    })
  })
  describe('using sinon', function () {
    describe('match', function () {
      it('object ids should match themselves', function () {
        sinon.assert.match(ObjectId1, ObjectId1)
        sinon.assert.match(ObjectId2, ObjectId2)
      })
      it('different objects with the same id should match', function () {
        sinon.assert.match(ObjectId1a, ObjectId1b)
      })
      it('different object ids should not match', function () {
        expect(() => {
          sinon.assert.match(ObjectId1, ObjectId2)
        }).to.throw()
      })
      it('object id should not match a string with the same id (left operand)', function () {
        expect(() => {
          sinon.assert.match(ObjectId1, string1)
        }).to.throw()
      })
      it('object id should not match a string with the same id (right operand)', function () {
        expect(() => {
          sinon.assert.match(string1, ObjectId1)
        }).to.throw()
      })
      it('object id should not match a string with a different id', function () {
        expect(() => {
          sinon.assert.match(ObjectId1, string2)
        }).to.throw()
      })
      it('object id should not match a number with the same id (left operand)', function () {
        // This assertion fails because ObjectId2 becomes NaN when coerced to a number.
        expect(() => {
          sinon.assert.match(ObjectId2, 123)
        }).to.throw()
      })
      it('object id should not match a number with the same id (left operand) but does match when the ObjectId has decimal digits only', function () {
        // We would want this assertion to fail, but ObjectId1 becomes 1.1111...e+23
        // when coerced to a number, and this can match a number with the same value.
        //
        // For an(object, number) comparison sinon coerces the object to a number using ==
        // which takes the string representation of the object id and converts it to a number
        // via .valueOf. Most of the time this gives NaN because the object ids
        // are hexadecimal but if the ObjectId is a valid **decimal** number then it will
        // be coerced to that number. This behaviour is by design in sinon but I think we
        // can live with it because it is unlikely that we will compare an ObjectId to a
        // number and get a false positive.
        expect(() => {
          sinon.assert.match(ObjectId1, number1)
        }).to.not.throw()
      })
      it('object id should not match a number with the same id (right operand)', function () {
        expect(() => {
          sinon.assert.match(number1, ObjectId1)
        }).to.throw()
      })
      it('object id should not match the string representation with the same id (left operand)', function () {
        expect(() => {
          sinon.assert.match(ObjectId1, repr1)
        }).to.throw()
      })
      it('object id should not match the string representation with the same id (right operand)', function () {
        expect(() => {
          sinon.assert.match(repr1, ObjectId1)
        }).to.throw()
      })
    })
  })
})
