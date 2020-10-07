const { expect } = require('chai')
const { exec } = require('child_process')
const { ObjectId } = require('mongodb')

const User = require('./helpers/User').promises

describe('ConvertArchivedState', function() {
  let userOne, userTwo, userThree, userFour
  let projectOne, projectOneId
  let projectTwo, projectTwoId
  let projectThree, projectThreeId
  let projectFour, projectFourId

  beforeEach(async function() {
    userOne = new User()
    userTwo = new User()
    userThree = new User()
    userFour = new User()
    await userOne.login()
    await userTwo.login()
    await userThree.login()
    await userFour.login()

    projectOneId = await userOne.createProject('old-archived-1', {
      template: 'blank'
    })

    projectOne = await userOne.getProject(projectOneId)
    projectOne.archived = true
    projectOne.collaberator_refs.push(userTwo._id)
    projectOne.tokenAccessReadOnly_refs.push(userThree._id)

    await userOne.saveProject(projectOne)

    projectTwoId = await userOne.createProject('old-archived-2', {
      template: 'blank'
    })

    projectTwo = await userOne.getProject(projectTwoId)
    projectTwo.archived = true
    projectTwo.tokenAccessReadAndWrite_refs.push(userThree._id)
    projectTwo.tokenAccessReadOnly_refs.push(userFour._id)

    await userOne.saveProject(projectTwo)

    projectThreeId = await userOne.createProject('already-new-archived', {
      template: 'blank'
    })
    projectThree = await userOne.getProject(projectThreeId)
    projectThree.archived = [
      ObjectId(userOne._id),
      ObjectId(userTwo._id),
      ObjectId(userFour._id)
    ]
    projectThree.collaberator_refs.push(userTwo._id)
    projectThree.tokenAccessReadOnly_refs.push(userFour._id)

    await userOne.saveProject(projectThree)

    projectFourId = await userOne.createProject('not-archived', {
      template: 'blank'
    })
    projectFour = await userOne.getProject(projectFourId)
    projectFour.archived = false

    await userOne.saveProject(projectFour)
  })

  beforeEach(function(done) {
    exec(
      'CONNECT_DELAY=1 node scripts/convert_archived_state.js',
      (error, stdout, stderr) => {
        console.log(stdout)
        console.error(stderr)
        if (error) {
          return done(error)
        }
        done()
      }
    )
  })

  describe('main method', function() {
    it('should change a project archived boolean to an array', async function() {
      projectOne = await userOne.getProject(projectOneId)
      projectTwo = await userOne.getProject(projectTwoId)
      expect(convertObjectIdsToStrings(projectOne.archived)).to.deep.equal([
        userOne._id,
        userTwo._id,
        userThree._id
      ])

      expect(convertObjectIdsToStrings(projectTwo.archived)).to.deep.equal([
        userOne._id,
        userThree._id,
        userFour._id
      ])
    })

    it('should not change the value of a project already archived with an array', async function() {
      projectThree = await userOne.getProject(projectThreeId)
      expect(convertObjectIdsToStrings(projectThree.archived)).to.deep.equal([
        userOne._id,
        userTwo._id,
        userFour._id
      ])
    })

    it('should change a none-archived project with a boolean value to an array', async function() {
      projectFour = await userOne.getProject(projectFourId)
      expect(convertObjectIdsToStrings(projectFour.archived)).to.deep.equal([])
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
