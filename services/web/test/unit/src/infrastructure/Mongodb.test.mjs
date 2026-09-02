import mongodb from 'mongodb-legacy'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import sinon from 'sinon'

const { ObjectId } = mongodb

const MODULE_PATH = '../../../../app/src/infrastructure/mongodb.mjs'
const MAIN_URL = 'mongodb://main'
const AUX_URL = 'mongodb://aux'

function makeFakeCollection() {
  return {
    find: sinon.stub(),
    findOne: sinon.stub(),
    aggregate: sinon.stub(),
    insertMany: sinon.stub().resolves({ ok: true }),
    bulkWrite: sinon.stub().resolves({ ok: true }),
    updateOne: sinon.stub().resolves({ ok: true }),
    findOneAndUpdate: sinon.stub().resolves({ ok: true }),
    findOneAndDelete: sinon.stub().resolves({ ok: true }),
  }
}

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

describe('auxiliary cluster support', function () {
  let collectionsByUrl, clients

  beforeEach(function () {
    collectionsByUrl = {
      [MAIN_URL]: new Map(),
      [AUX_URL]: new Map(),
    }
    clients = []

    class FakeMongoClient {
      constructor(url, options) {
        this.url = url
        this.options = options
        this.connect = sinon.stub().resolves(this)
        this.close = sinon.stub().resolves()
        clients.push(this)
      }

      on() {}

      db() {
        const store = collectionsByUrl[this.url]
        return {
          collection(name) {
            if (!store.has(name)) {
              store.set(name, makeFakeCollection())
            }
            return store.get(name)
          },
        }
      }
    }

    vi.doMock('mongodb-legacy', () => ({
      default: { ...mongodb, MongoClient: FakeMongoClient },
    }))

    vi.doMock('../../../../app/src/infrastructure/Mongoose.mjs', () => ({
      default: { mongo: { ObjectId } },
    }))
  })

  async function loadModule(auxUrl) {
    vi.doMock('@overleaf/settings', () => ({
      default: {
        mongo: {
          url: MAIN_URL,
          auxUrl,
          options: {},
          hasSecondaries: false,
        },
      },
    }))
    return import(MODULE_PATH)
  }

  describe('when no auxiliary cluster is configured', function () {
    it('only creates a client for the main cluster', async function () {
      await loadModule(undefined)
      expect(clients).to.have.lengthOf(1)
      expect(clients[0].url).to.equal(MAIN_URL)
    })

    it('exposes the plain main-cluster collection, unwrapped', async function () {
      const { db } = await loadModule(undefined)
      const mainCollection = collectionsByUrl[MAIN_URL].get('libraryReferences')
      expect(db.libraryReferences).to.equal(mainCollection)
    })

    it('waits for the main cluster connection only', async function () {
      const { waitForDb } = await loadModule(undefined)
      await expect(waitForDb()).to.eventually.be.fulfilled
      expect(clients[0].connect).to.have.been.called
    })
  })

  describe('when an auxiliary cluster is configured', function () {
    it('creates a client for both clusters', async function () {
      await loadModule(AUX_URL)
      expect(clients).to.have.lengthOf(2)
      expect(clients.map(c => c.url)).to.include.members([MAIN_URL, AUX_URL])
    })

    it('exposes the plain auxiliary-cluster collection, unwrapped', async function () {
      const { db } = await loadModule(AUX_URL)
      const auxCollection = collectionsByUrl[AUX_URL].get('libraryReferences')
      expect(db.libraryReferences).to.equal(auxCollection)
    })

    it('only reads and writes to the auxiliary collection', async function () {
      const { db } = await loadModule(AUX_URL)
      await db.libraryReferences.find({ userId: 'abc' })
      await db.libraryReferences.insertMany([{ _id: 1 }], { ordered: false })

      const auxCollection = collectionsByUrl[AUX_URL].get('libraryReferences')
      expect(auxCollection.find).to.have.been.calledWith({
        userId: 'abc',
      })
      expect(auxCollection.insertMany).to.have.been.calledWith([{ _id: 1 }], {
        ordered: false,
      })
      expect(collectionsByUrl[MAIN_URL].has('libraryReferences')).to.be.false
    })

    it('waits for both the main and auxiliary connections', async function () {
      const { waitForDb } = await loadModule(AUX_URL)
      await expect(waitForDb()).to.eventually.be.fulfilled
      expect(clients[0].connect).to.have.been.called
      expect(clients[1].connect).to.have.been.called
    })
  })
})
