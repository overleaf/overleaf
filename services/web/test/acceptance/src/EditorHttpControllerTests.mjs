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
  describe('joinProject', function () {
    it('returns project details', function (done) {
      this.user.joinProject(this.projectId, (error, details) => {
        if (error) return done(error)

        expect(details.project.name).to.equal(this.projectName)
        done()
      })
    })
  })
})
