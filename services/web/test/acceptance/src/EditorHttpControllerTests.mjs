import User from './helpers/User.mjs'
import { expect } from 'chai'

describe('EditorHttpController', function () {
  beforeEach('login', function (done) {
    this.user = new User()
    this.user.login(done)
  })
  beforeEach('create project', function (done) {
    this.projectName = 'wombat'
    this.user.createProject(this.projectName, (error, projectId) => {
      if (error) return done(error)
      this.projectId = projectId
      done()
    })
  })
  beforeEach('create doc', function (done) {
    this.user.createDocInProject(
      this.projectId,
      null,
      'potato.tex',
      (error, docId) => {
        this.docId = docId
        done(error)
      }
    )
  })

  describe('joinProject', function () {
    it('should emit an empty deletedDocs array', function (done) {
      this.user.joinProject(this.projectId, (error, details) => {
        if (error) return done(error)

        expect(details.project.deletedDocs).to.deep.equal([])
        done()
      })
    })

    describe('after deleting a doc', function () {
      beforeEach(function (done) {
        this.user.deleteItemInProject(this.projectId, 'doc', this.docId, done)
      })

      it('should include the deleted doc in the deletedDocs array', function (done) {
        this.user.joinProject(this.projectId, (error, details) => {
          if (error) return done(error)

          expect(details.project.deletedDocs).to.deep.equal([
            { _id: this.docId, name: 'potato.tex' },
          ])
          done()
        })
      })
    })
  })
})
