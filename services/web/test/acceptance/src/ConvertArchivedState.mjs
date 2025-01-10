import { expect } from 'chai'
import { exec } from 'node:child_process'
import mongodb from 'mongodb-legacy'
import UserHelper from './helpers/User.mjs'

const User = UserHelper.promises

const ObjectId = mongodb.ObjectId

describe('ConvertArchivedState', function () {
  let userOne, userTwo, userThree, userFour
  let projectOne, projectOneId
  let projectTwo, projectTwoId
  let projectThree, projectThreeId
  let projectFour, projectFourId
  let projectIdTrashed
  let projectIdNotTrashed
  let projectIdArchivedAndTrashed
  let projectIdNotArchivedNotTrashed

  beforeEach(async function () {
    userOne = new User()
    userTwo = new User()
    userThree = new User()
    userFour = new User()
    await userOne.login()
    await userTwo.login()
    await userThree.login()
    await userFour.login()

    projectOneId = await userOne.createProject('old-archived-1', {
      template: 'blank',
    })

    projectOne = await userOne.getProject(projectOneId)
    projectOne.archived = true
    projectOne.collaberator_refs.push(userTwo._id)
    projectOne.tokenAccessReadOnly_refs.push(userThree._id)

    await userOne.saveProject(projectOne)

    projectTwoId = await userOne.createProject('old-archived-2', {
      template: 'blank',
    })

    projectTwo = await userOne.getProject(projectTwoId)
    projectTwo.archived = true
    projectTwo.tokenAccessReadAndWrite_refs.push(userThree._id)
    projectTwo.tokenAccessReadOnly_refs.push(userFour._id)

    await userOne.saveProject(projectTwo)

    projectThreeId = await userOne.createProject('already-new-archived', {
      template: 'blank',
    })
    projectThree = await userOne.getProject(projectThreeId)
    projectThree.archived = [
      new ObjectId(userOne._id),
      new ObjectId(userTwo._id),
      new ObjectId(userFour._id),
    ]
    projectThree.collaberator_refs.push(userTwo._id)
    projectThree.tokenAccessReadOnly_refs.push(userFour._id)

    await userOne.saveProject(projectThree)

    projectFourId = await userOne.createProject('not-archived', {
      template: 'blank',
    })
    projectFour = await userOne.getProject(projectFourId)
    projectFour.archived = false

    await userOne.saveProject(projectFour)

    projectIdTrashed = await userOne.createProject('trashed', {
      template: 'blank',
    })
    {
      const p = await userOne.getProject(projectIdTrashed)
      p.trashed = true
      p.collaberator_refs.push(userTwo._id)
      await userOne.saveProject(p)
    }

    projectIdNotTrashed = await userOne.createProject('not-trashed', {
      template: 'blank',
    })
    {
      const p = await userOne.getProject(projectIdNotTrashed)
      p.trashed = false
      p.collaberator_refs.push(userTwo._id)
      await userOne.saveProject(p)
    }

    projectIdArchivedAndTrashed = await userOne.createProject('not-trashed', {
      template: 'blank',
    })
    {
      const p = await userOne.getProject(projectIdArchivedAndTrashed)
      p.archived = true
      p.trashed = true
      p.collaberator_refs.push(userTwo._id)
      await userOne.saveProject(p)
    }

    projectIdNotArchivedNotTrashed = await userOne.createProject(
      'not-archived,not-trashed',
      {
        template: 'blank',
      }
    )
    {
      const p = await userOne.getProject(projectIdNotArchivedNotTrashed)
      p.archived = false
      p.trashed = false
      p.collaberator_refs.push(userTwo._id)
      await userOne.saveProject(p)
    }
  })

  beforeEach(function (done) {
    exec(
      'CONNECT_DELAY=1 node scripts/convert_archived_state.mjs FIRST,SECOND',
      error => {
        if (error) {
          return done(error)
        }
        done()
      }
    )
  })

  describe('main method', function () {
    it('should change a project archived boolean to an array', async function () {
      projectOne = await userOne.getProject(projectOneId)
      projectTwo = await userOne.getProject(projectTwoId)
      expect(convertObjectIdsToStrings(projectOne.archived)).to.deep.equal([
        userOne._id,
        userTwo._id,
        userThree._id,
      ])

      expect(convertObjectIdsToStrings(projectTwo.archived)).to.deep.equal([
        userOne._id,
        userThree._id,
        userFour._id,
      ])
      expect(projectTwo.trashed).to.deep.equal([])
    })

    it('should not change the value of a project already archived with an array', async function () {
      projectThree = await userOne.getProject(projectThreeId)
      expect(convertObjectIdsToStrings(projectThree.archived)).to.deep.equal([
        userOne._id,
        userTwo._id,
        userFour._id,
      ])
      expect(projectThree.trashed).to.deep.equal([])
    })

    it('should change a none-archived project with a boolean value to an array', async function () {
      projectFour = await userOne.getProject(projectFourId)
      expect(convertObjectIdsToStrings(projectFour.archived)).to.deep.equal([])
      expect(projectFour.trashed).to.deep.equal([])
    })

    it('should change a archived and trashed project with a boolean value to an array', async function () {
      const p = await userOne.getProject(projectIdArchivedAndTrashed)
      expect(convertObjectIdsToStrings(p.archived)).to.deep.equal([
        userOne._id,
        userTwo._id,
      ])
      expect(convertObjectIdsToStrings(p.trashed)).to.deep.equal([
        userOne._id,
        userTwo._id,
      ])
    })

    it('should change a trashed project with a boolean value to an array', async function () {
      const p = await userOne.getProject(projectIdTrashed)
      expect(p.archived).to.not.exist
      expect(convertObjectIdsToStrings(p.trashed)).to.deep.equal([
        userOne._id,
        userTwo._id,
      ])
    })

    it('should change a not-trashed project with a boolean value to an array', async function () {
      const p = await userOne.getProject(projectIdNotTrashed)
      expect(p.archived).to.not.exist
      expect(convertObjectIdsToStrings(p.trashed)).to.deep.equal([])
    })

    it('should change a not-archived/not-trashed project with a boolean value to an array', async function () {
      const p = await userOne.getProject(projectIdNotArchivedNotTrashed)
      expect(p.archived).to.deep.equal([])
      expect(p.trashed).to.deep.equal([])
    })
  })

  function convertObjectIdsToStrings(ids) {
    if (typeof ids === 'object') {
      return ids.map(id => {
        return id.toString()
      })
    }
  }
})
