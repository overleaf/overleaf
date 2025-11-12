import { expect } from 'chai'
import mongodb from 'mongodb-legacy'
import mongoose from 'mongoose'
import { User as UserModel } from '../../../app/src/models/User.js'
import { db } from '../../../app/src/infrastructure/mongodb.js'
import {
  normalizeQuery,
  normalizeMultiQuery,
} from '../../../app/src/Features/Helpers/Mongo.js'
import UserHelper from './helpers/User.mjs'

const User = UserHelper.promises

const NativeObjectId = mongodb.ObjectId

const MongooseObjectId = mongoose.Types.ObjectId

describe('MongoTests', function () {
  let userIdAsString, userEmail, userIds
  beforeEach(async function setUpUsers() {
    // the first user in the db should not match the target user
    const otherUser = new User()
    await otherUser.ensureUserExists()

    const user = new User()
    await user.ensureUserExists()
    userIdAsString = user.id
    userEmail = user.email

    // the last user in the db should not match the target user
    const yetAnotherUser = new User()
    await yetAnotherUser.ensureUserExists()

    userIds = [otherUser.id, user.id, yetAnotherUser.id]
  })

  describe('normalizeQuery', function () {
    async function expectToWork(blob) {
      const query = normalizeQuery(blob)

      expect(query).to.exist
      expect(query._id).to.be.instanceof(NativeObjectId)
      expect(query._id).to.deep.equal(new NativeObjectId(userIdAsString))

      const user = await db.users.findOne(query)
      expect(user).to.exist
      expect(user.email).to.equal(userEmail)
    }

    it('should work with the user id as string', async function () {
      await expectToWork(userIdAsString)
    })

    it('should work with the user id in an object', async function () {
      await expectToWork({ _id: userIdAsString })
    })

    it('should pass back the object with id', function () {
      const inputQuery = { _id: userIdAsString, other: 1 }
      const query = normalizeMultiQuery(inputQuery)
      expect(inputQuery).to.equal(query)
    })

    describe('with an ObjectId from mongoose', function () {
      let user
      beforeEach(async function getUser() {
        user = await UserModel.findById(userIdAsString).exec()
        expect(user).to.exist
        expect(user._id).to.exist
        expect(user.email).to.equal(userEmail)
      })

      it('should have a mongoose ObjectId', function () {
        expect(user._id).to.be.instanceof(MongooseObjectId)
      })

      it('should work with the users _id field', async function () {
        await expectToWork(user._id)
      })
    })

    describe('with an ObjectId from the native driver', function () {
      let user
      beforeEach(async function getUser() {
        user = await db.users.findOne({
          _id: new NativeObjectId(userIdAsString),
        })
        expect(user).to.exist
        expect(user._id).to.exist
        expect(user.email).to.equal(userEmail)
      })

      it('should have a native ObjectId', function () {
        expect(user._id).to.be.instanceof(NativeObjectId)
      })

      it('should work with the users _id field', async function () {
        await expectToWork(user._id)
      })
    })
  })

  describe('normalizeMultiQuery', function () {
    let ghost
    beforeEach(async function addGhost() {
      // add a user which is not part of the initial three users
      ghost = new User()
      ghost.emails[0].email = ghost.email = 'ghost@ghost.com'
      await ghost.ensureUserExists()
    })

    async function expectToFindTheThreeUsers(query) {
      const users = await db.users.find(query).toArray()

      expect(users).to.have.length(3)
      expect(users.map(user => user._id.toString()).sort()).to.deep.equal(
        userIds.sort()
      )
    }

    describe('with an array as query', function () {
      function expectInQueryWithNativeObjectIds(query) {
        expect(query).to.exist
        expect(query._id).to.exist
        expect(query._id.$in).to.exist
        expect(
          query._id.$in.map(id => id instanceof NativeObjectId)
        ).to.deep.equal([true, true, true])
      }

      it('should transform all strings to native ObjectIds', function () {
        const query = normalizeMultiQuery(userIds)
        expectInQueryWithNativeObjectIds(query)
      })
      it('should transform all Mongoose ObjectIds to native ObjectIds', function () {
        const query = normalizeMultiQuery(
          userIds.map(userId => new NativeObjectId(userId))
        )
        expectInQueryWithNativeObjectIds(query)
      })
      it('should leave all native Objects as native ObjectIds', function () {
        const query = normalizeMultiQuery(
          userIds.map(userId => new NativeObjectId(userId))
        )
        expectInQueryWithNativeObjectIds(query)
      })

      it('should find the three users from string ids', async function () {
        const query = normalizeMultiQuery(userIds)
        await expectToFindTheThreeUsers(query)
      })
      it('should find the three users from Mongoose ObjectIds', async function () {
        const query = normalizeMultiQuery(
          userIds.map(userId => new NativeObjectId(userId))
        )
        await expectToFindTheThreeUsers(query)
      })
      it('should find the three users from native ObjectIds', async function () {
        const query = normalizeMultiQuery(
          userIds.map(userId => new NativeObjectId(userId))
        )
        await expectToFindTheThreeUsers(query)
      })
    })

    describe('with an object as query', function () {
      beforeEach(async function addHiddenFlag() {
        // add a mongo field that does not exist on the other users
        await ghost.mongoUpdate({ $set: { hidden: 1 } })
      })

      it('should pass through the query', function () {
        const inputQuery = { complex: 1 }
        const query = normalizeMultiQuery(inputQuery)
        expect(inputQuery).to.equal(query)
      })

      describe('when searching for hidden users', function () {
        it('should match the ghost only', async function () {
          const query = normalizeMultiQuery({ hidden: 1 })

          const users = await db.users.find(query).toArray()
          expect(users).to.have.length(1)
          expect(users[0]._id.toString()).to.equal(ghost.id)
        })
      })

      describe('when searching for non hidden users', function () {
        it('should find the three users', async function () {
          const query = normalizeMultiQuery({ hidden: { $exists: false } })

          await expectToFindTheThreeUsers(query)
        })
      })
    })
  })
})
