import { expect } from 'chai'
import mongodb from 'mongodb-legacy'
import nock from 'nock'
import * as ProjectHistoryClient from './helpers/ProjectHistoryClient.js'
import * as ProjectHistoryApp from './helpers/ProjectHistoryApp.js'
const { ObjectId } = mongodb

const MockHistoryStore = () => nock('http://127.0.0.1:3100')
const MockWeb = () => nock('http://127.0.0.1:3000')

const fixture = path => new URL(`../fixtures/${path}`, import.meta.url)

describe('Labels', function () {
  beforeEach(async function () {
    await ProjectHistoryApp.ensureRunning()

    this.historyId = new ObjectId().toString()
    MockHistoryStore().post('/api/projects').reply(200, {
      projectId: this.historyId,
    })

    const olProject = await ProjectHistoryClient.initializeProject(
      this.historyId
    )
    this.project_id = new ObjectId().toString()
    MockWeb()
      .get(`/project/${this.project_id}/details`)
      .reply(200, {
        name: 'Test Project',
        overleaf: { history: { id: olProject.id } },
      })

    MockHistoryStore()
      .get(`/api/projects/${this.historyId}/latest/history`)
      .replyWithFile(200, fixture('chunks/7-8.json'))

    MockHistoryStore()
      .get(`/api/projects/${this.historyId}/versions/7/history`)
      .replyWithFile(200, fixture('chunks/7-8.json'))
      .persist()
    MockHistoryStore()
      .get(`/api/projects/${this.historyId}/versions/8/history`)
      .replyWithFile(200, fixture('chunks/7-8.json'))
      .persist()

    this.comment = 'a saved version comment'
    this.comment2 = 'another saved version comment'
    this.user_id = new ObjectId().toString()
    this.created_at = new Date(1)
  })

  afterEach(function () {
    nock.cleanAll()
  })

  it('can create and get labels', async function () {
    const label = await ProjectHistoryClient.createLabel(
      this.project_id,
      this.user_id,
      7,
      this.comment,
      this.created_at
    )
    const labels = await ProjectHistoryClient.getLabels(this.project_id)
    expect(labels).to.deep.equal([label])
  })

  it('can create and get labels with no user id', async function () {
    const userId = undefined
    const label = await ProjectHistoryClient.createLabel(
      this.project_id,
      userId,
      7,
      this.comment,
      this.created_at
    )
    const labels = await ProjectHistoryClient.getLabels(this.project_id)
    expect(labels).to.deep.equal([label])
  })

  it('can delete labels', async function () {
    const label = await ProjectHistoryClient.createLabel(
      this.project_id,
      this.user_id,
      7,
      this.comment,
      this.created_at
    )
    await ProjectHistoryClient.deleteLabel(this.project_id, label.id)
    const labels = await ProjectHistoryClient.getLabels(this.project_id)
    expect(labels).to.deep.equal([])
  })

  it('can delete labels for the current user', async function () {
    const label = await ProjectHistoryClient.createLabel(
      this.project_id,
      this.user_id,
      7,
      this.comment,
      this.created_at
    )
    await ProjectHistoryClient.deleteLabelForUser(
      this.project_id,
      this.user_id,
      label.id
    )
    const labels = await ProjectHistoryClient.getLabels(this.project_id)
    expect(labels).to.deep.equal([])
  })

  it('can transfer ownership of labels', async function () {
    const fromUser = new ObjectId().toString()
    const toUser = new ObjectId().toString()
    const label = await ProjectHistoryClient.createLabel(
      this.project_id,
      fromUser,
      7,
      this.comment,
      this.created_at
    )
    const label2 = await ProjectHistoryClient.createLabel(
      this.project_id,
      fromUser,
      7,
      this.comment2,
      this.created_at
    )
    await ProjectHistoryClient.transferLabelOwnership(fromUser, toUser)
    const labels = await ProjectHistoryClient.getLabels(this.project_id)
    expect(labels).to.deep.equal([
      {
        id: label.id,
        comment: label.comment,
        version: label.version,
        created_at: label.created_at,
        user_id: toUser,
      },
      {
        id: label2.id,
        comment: label2.comment,
        version: label2.version,
        created_at: label2.created_at,
        user_id: toUser,
      },
    ])
  })

  it('should return labels with summarized updates', async function () {
    const label = await ProjectHistoryClient.createLabel(
      this.project_id,
      this.user_id,
      8,
      this.comment,
      this.created_at
    )
    const updates = await ProjectHistoryClient.getSummarizedUpdates(
      this.project_id,
      { min_count: 1 }
    )
    expect(updates).to.deep.equal({
      nextBeforeTimestamp: 6,
      updates: [
        {
          fromV: 6,
          toV: 8,
          meta: {
            users: ['5a5637efdac84e81b71014c4', 31],
            start_ts: 1512383567277,
            end_ts: 1512383572877,
          },
          pathnames: ['bar.tex', 'main.tex'],
          project_ops: [],
          labels: [
            {
              id: label.id.toString(),
              comment: this.comment,
              version: 8,
              user_id: this.user_id,
              created_at: this.created_at.toISOString(),
            },
          ],
        },
      ],
    })
  })
})
