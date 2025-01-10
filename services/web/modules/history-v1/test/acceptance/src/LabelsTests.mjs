import { expect } from 'chai'
import mongodb from 'mongodb-legacy'
import User from '../../../../../test/acceptance/src/helpers/User.mjs'
import MockProjectHistoryApiClass from '../../../../../test/acceptance/src/mocks/MockProjectHistoryApi.mjs'

const { ObjectId } = mongodb

let MockProjectHistoryApi

before(function () {
  MockProjectHistoryApi = MockProjectHistoryApiClass.instance()
})

describe('Labels', function () {
  beforeEach(function (done) {
    this.owner = new User()
    this.owner.login(error => {
      if (error) {
        throw error
      }
      this.owner.createProject(
        'example-project',
        { template: 'example' },
        (error, projectId) => {
          this.project_id = projectId
          if (error) {
            throw error
          }
          done()
        }
      )
    })
  })

  it('getting labels', function (done) {
    const labelId = new ObjectId().toString()
    const comment = 'a label comment'
    const version = 3
    MockProjectHistoryApi.addLabel(this.project_id, {
      id: labelId,
      comment,
      version,
    })

    this.owner.request(
      {
        method: 'GET',
        url: `/project/${this.project_id}/labels`,
        json: true,
      },
      (error, response, body) => {
        if (error) {
          throw error
        }
        expect(response.statusCode).to.equal(200)
        expect(body).to.deep.equal([{ id: labelId, comment, version }])
        done()
      }
    )
  })

  it('creating a label', function (done) {
    const comment = 'a label comment'
    const version = 3

    this.owner.request(
      {
        method: 'POST',
        url: `/project/${this.project_id}/labels`,
        json: { comment, version },
      },
      (error, response, body) => {
        if (error) {
          throw error
        }
        expect(response.statusCode).to.equal(200)
        const { label_id: labelId } = body
        expect(MockProjectHistoryApi.getLabels(this.project_id)).to.deep.equal([
          { id: labelId, comment, version },
        ])
        done()
      }
    )
  })

  it('deleting a label', function (done) {
    const labelId = new ObjectId().toString()
    const comment = 'a label comment'
    const version = 3
    MockProjectHistoryApi.addLabel(this.project_id, {
      id: labelId,
      comment,
      version,
    })

    this.owner.request(
      {
        method: 'DELETE',
        url: `/project/${this.project_id}/labels/${labelId}`,
        json: true,
      },
      (error, response, body) => {
        if (error) {
          throw error
        }
        expect(response.statusCode).to.equal(204)
        expect(MockProjectHistoryApi.getLabels(this.project_id)).to.deep.equal(
          []
        )
        done()
      }
    )
  })
})
