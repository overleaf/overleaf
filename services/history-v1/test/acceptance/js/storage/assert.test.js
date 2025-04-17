'use strict'

const OError = require('@overleaf/o-error')
const { expect } = require('chai')
const assert = require('../../../../storage/lib/assert')

describe('assert', function () {
  describe('blobHash', function () {
    it('should not throw for valid blob hashes', function () {
      expect(() =>
        assert.blobHash(
          'aad321caf77ca6c5ab09e6c638c237705f93b001',
          'should be a blob hash'
        )
      ).to.not.throw()
    })

    it('should throw for invalid blob hashes', function () {
      try {
        assert.blobHash('invalid-hash', 'should be a blob hash')
        expect.fail()
      } catch (error) {
        expect(error).to.be.instanceOf(TypeError)
        expect(error.message).to.equal('should be a blob hash')
        expect(OError.getFullInfo(error)).to.deep.equal({ arg: 'invalid-hash' })
      }
    })

    it('should throw for string integer blob hashes', function () {
      try {
        assert.blobHash('123', 'should be a blob hash')
        expect.fail()
      } catch (error) {
        expect(error).to.be.instanceOf(TypeError)
        expect(error.message).to.equal('should be a blob hash')
        expect(OError.getFullInfo(error)).to.deep.equal({ arg: '123' })
      }
    })
  })

  describe('projectId', function () {
    it('should not throw for valid mongo project ids', function () {
      expect(() =>
        assert.projectId('507f1f77bcf86cd799439011', 'should be a project id')
      ).to.not.throw()
    })

    it('should not throw for valid postgres project ids', function () {
      expect(() =>
        assert.projectId('123456789', 'should be a project id')
      ).to.not.throw()
    })

    it('should throw for invalid project ids', function () {
      try {
        assert.projectId('invalid-id', 'should be a project id')
        expect.fail()
      } catch (error) {
        expect(error).to.be.instanceOf(TypeError)
        expect(error.message).to.equal('should be a project id')
        expect(OError.getFullInfo(error)).to.deep.equal({ arg: 'invalid-id' })
      }
    })

    it('should throw for non-numeric project ids', function () {
      try {
        assert.projectId('12345x', 'should be a project id')
        expect.fail()
      } catch (error) {
        expect(error).to.be.instanceOf(TypeError)
        expect(error.message).to.equal('should be a project id')
        expect(OError.getFullInfo(error)).to.deep.equal({ arg: '12345x' })
      }
    })

    it('should throw for postgres ids starting with 0', function () {
      try {
        assert.projectId('0123456', 'should be a project id')
        expect.fail()
      } catch (error) {
        expect(error).to.be.instanceOf(TypeError)
        expect(error.message).to.equal('should be a project id')
        expect(OError.getFullInfo(error)).to.deep.equal({ arg: '0123456' })
      }
    })
  })

  describe('chunkId', function () {
    it('should not throw for valid mongo chunk ids', function () {
      expect(() =>
        assert.chunkId('507f1f77bcf86cd799439011', 'should be a chunk id')
      ).to.not.throw()
    })

    it('should not throw for valid postgres chunk ids', function () {
      expect(() =>
        assert.chunkId('123456789', 'should be a chunk id')
      ).to.not.throw()
    })

    it('should throw for invalid chunk ids', function () {
      try {
        assert.chunkId('invalid-id', 'should be a chunk id')
        expect.fail()
      } catch (error) {
        expect(error).to.be.instanceOf(TypeError)
        expect(error.message).to.equal('should be a chunk id')
        expect(OError.getFullInfo(error)).to.deep.equal({ arg: 'invalid-id' })
      }
    })

    it('should throw for integer chunk ids', function () {
      try {
        assert.chunkId(12345, 'should be a chunk id')
        expect.fail()
      } catch (error) {
        expect(error).to.be.instanceOf(TypeError)
        expect(error.message).to.equal('should be a chunk id')
        expect(OError.getFullInfo(error)).to.deep.equal({ arg: 12345 })
      }
    })
  })

  describe('mongoId', function () {
    it('should not throw for valid mongo ids', function () {
      expect(() =>
        assert.mongoId('507f1f77bcf86cd799439011', 'should be a mongo id')
      ).to.not.throw()
    })

    it('should throw for invalid mongo ids', function () {
      try {
        assert.mongoId('invalid-id', 'should be a mongo id')
        expect.fail()
      } catch (error) {
        expect(error).to.be.instanceOf(TypeError)
        expect(error.message).to.equal('should be a mongo id')
        expect(OError.getFullInfo(error)).to.deep.equal({ arg: 'invalid-id' })
      }
    })

    it('should throw for numeric mongo ids', function () {
      try {
        assert.mongoId('12345', 'should be a mongo id')
        expect.fail()
      } catch (error) {
        expect(error).to.be.instanceOf(TypeError)
        expect(error.message).to.equal('should be a mongo id')
        expect(OError.getFullInfo(error)).to.deep.equal({ arg: '12345' })
      }
    })

    it('should throw for mongo ids that are too short', function () {
      try {
        assert.mongoId('507f1f77bcf86cd79943901', 'should be a mongo id')
        expect.fail()
      } catch (error) {
        expect(error).to.be.instanceOf(TypeError)
        expect(error.message).to.equal('should be a mongo id')
        expect(OError.getFullInfo(error)).to.deep.equal({
          arg: '507f1f77bcf86cd79943901',
        })
      }
    })

    it('should throw for mongo ids that are too long', function () {
      try {
        assert.mongoId('507f1f77bcf86cd7994390111', 'should be a mongo id')
        expect.fail()
      } catch (error) {
        expect(error).to.be.instanceOf(TypeError)
        expect(error.message).to.equal('should be a mongo id')
        expect(OError.getFullInfo(error)).to.deep.equal({
          arg: '507f1f77bcf86cd7994390111',
        })
      }
    })
  })

  describe('postgresId', function () {
    it('should not throw for valid postgres ids', function () {
      expect(() =>
        assert.postgresId('123456789', 'should be a postgres id')
      ).to.not.throw()
      expect(() =>
        assert.postgresId('1', 'should be a postgres id')
      ).to.not.throw()
    })

    it('should throw for invalid postgres ids', function () {
      try {
        assert.postgresId('invalid-id', 'should be a postgres id')
        expect.fail()
      } catch (error) {
        expect(error).to.be.instanceOf(TypeError)
        expect(error.message).to.equal('should be a postgres id')
        expect(OError.getFullInfo(error)).to.deep.equal({ arg: 'invalid-id' })
      }
    })

    it('should throw for postgres ids starting with 0', function () {
      try {
        assert.postgresId('0123456', 'should be a postgres id')
        expect.fail()
      } catch (error) {
        expect(error).to.be.instanceOf(TypeError)
        expect(error.message).to.equal('should be a postgres id')
        expect(OError.getFullInfo(error)).to.deep.equal({ arg: '0123456' })
      }
    })

    it('should throw for postgres ids that are too long', function () {
      try {
        assert.postgresId('12345678901', 'should be a postgres id')
        expect.fail()
      } catch (error) {
        expect(error).to.be.instanceOf(TypeError)
        expect(error.message).to.equal('should be a postgres id')
        expect(OError.getFullInfo(error)).to.deep.equal({ arg: '12345678901' })
      }
    })
  })

  describe('regex constants', function () {
    it('MONGO_ID_REGEXP should match valid mongo ids', function () {
      expect('507f1f77bcf86cd799439011').to.match(assert.MONGO_ID_REGEXP)
      expect('abcdef0123456789abcdef01').to.match(assert.MONGO_ID_REGEXP)
    })

    it('MONGO_ID_REGEXP should not match invalid mongo ids', function () {
      expect('invalid-id').to.not.match(assert.MONGO_ID_REGEXP)
      expect('507f1f77bcf86cd79943901').to.not.match(assert.MONGO_ID_REGEXP) // too short
      expect('507f1f77bcf86cd7994390111').to.not.match(assert.MONGO_ID_REGEXP) // too long
      expect('507F1F77BCF86CD799439011').to.not.match(assert.MONGO_ID_REGEXP) // uppercase
    })

    it('POSTGRES_ID_REGEXP should match valid postgres ids', function () {
      expect('123456789').to.match(assert.POSTGRES_ID_REGEXP)
      expect('1').to.match(assert.POSTGRES_ID_REGEXP)
    })

    it('POSTGRES_ID_REGEXP should not match invalid postgres ids', function () {
      expect('invalid-id').to.not.match(assert.POSTGRES_ID_REGEXP)
      expect('0123456').to.not.match(assert.POSTGRES_ID_REGEXP) // starts with 0
      expect('12345678901').to.not.match(assert.POSTGRES_ID_REGEXP) // too long (> 10 digits)
    })
  })
})
