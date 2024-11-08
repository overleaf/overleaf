/* eslint-disable
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import sinon from 'sinon'
import { expect } from 'chai'
import Settings from '@overleaf/settings'
import request from 'request'
import assert from 'node:assert'
import mongodb from 'mongodb-legacy'
import nock from 'nock'
import * as ProjectHistoryClient from './helpers/ProjectHistoryClient.js'
import * as ProjectHistoryApp from './helpers/ProjectHistoryApp.js'
const { ObjectId } = mongodb

const MockHistoryStore = () => nock('http://127.0.0.1:3100')
const MockFileStore = () => nock('http://127.0.0.1:3009')
const MockWeb = () => nock('http://127.0.0.1:3000')

const fixture = path => new URL(`../fixtures/${path}`, import.meta.url)

describe('Summarized updates', function () {
  beforeEach(function (done) {
    this.projectId = new ObjectId().toString()
    this.historyId = new ObjectId().toString()
    return ProjectHistoryApp.ensureRunning(error => {
      if (error != null) {
        throw error
      }

      MockHistoryStore().post('/api/projects').reply(200, {
        projectId: this.historyId,
      })

      return ProjectHistoryClient.initializeProject(
        this.historyId,
        (error, olProject) => {
          if (error != null) {
            throw error
          }
          MockWeb()
            .get(`/project/${this.projectId}/details`)
            .reply(200, {
              name: 'Test Project',
              overleaf: { history: { id: olProject.id } },
            })

          MockHistoryStore()
            .get(`/api/projects/${this.historyId}/latest/history`)
            .replyWithFile(200, fixture('chunks/7-8.json'))
          MockHistoryStore()
            .get(`/api/projects/${this.historyId}/versions/6/history`)
            .replyWithFile(200, fixture('chunks/4-6.json'))
          MockHistoryStore()
            .get(`/api/projects/${this.historyId}/versions/3/history`)
            .replyWithFile(200, fixture('chunks/0-3.json'))

          return done()
        }
      )
    })
  })

  afterEach(function () {
    return nock.cleanAll()
  })

  it('should return the latest summarized updates from a single chunk', function (done) {
    return ProjectHistoryClient.getSummarizedUpdates(
      this.projectId,
      { min_count: 1 },
      (error, updates) => {
        if (error != null) {
          throw error
        }
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
              labels: [],
            },
          ],
        })
        return done()
      }
    )
  })

  it('should return the latest summarized updates, with min_count spanning multiple chunks', function (done) {
    return ProjectHistoryClient.getSummarizedUpdates(
      this.projectId,
      { min_count: 5 },
      (error, updates) => {
        if (error != null) {
          throw error
        }
        expect(updates).to.deep.equal({
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
              labels: [],
            },
            {
              fromV: 5,
              toV: 6,
              meta: {
                users: [31],
                start_ts: 1512383366120,
                end_ts: 1512383366120,
              },
              pathnames: [],
              project_ops: [
                {
                  atV: 5,
                  rename: {
                    pathname: 'foo.tex',
                    newPathname: 'bar.tex',
                  },
                },
              ],
              labels: [],
            },
            {
              fromV: 2,
              toV: 5,
              meta: {
                users: [31],
                start_ts: 1512383313724,
                end_ts: 1512383362905,
              },
              pathnames: ['foo.tex'],
              project_ops: [],
              labels: [],
            },
            {
              fromV: 1,
              toV: 2,
              meta: {
                users: [31],
                start_ts: 1512383246874,
                end_ts: 1512383246874,
              },
              pathnames: [],
              project_ops: [
                {
                  atV: 1,
                  rename: {
                    pathname: 'bar.tex',
                    newPathname: 'foo.tex',
                  },
                },
              ],
              labels: [],
            },
            {
              fromV: 0,
              toV: 1,
              meta: {
                users: [31],
                start_ts: 1512383015633,
                end_ts: 1512383015633,
              },
              pathnames: ['main.tex'],
              project_ops: [],
              labels: [],
            },
          ],
        })
        return done()
      }
    )
  })

  it('should return the summarized updates from a before version at the start of a chunk', function (done) {
    MockHistoryStore()
      .get(`/api/projects/${this.historyId}/versions/4/history`)
      .replyWithFile(200, fixture('chunks/4-6.json'))
    return ProjectHistoryClient.getSummarizedUpdates(
      this.projectId,
      { before: 4 },
      (error, updates) => {
        if (error != null) {
          throw error
        }
        expect(updates.updates[0].toV).to.equal(4)
        return done()
      }
    )
  })

  it('should return the summarized updates from a before version in the middle of a chunk', function (done) {
    MockHistoryStore()
      .get(`/api/projects/${this.historyId}/versions/5/history`)
      .replyWithFile(200, fixture('chunks/4-6.json'))
    return ProjectHistoryClient.getSummarizedUpdates(
      this.projectId,
      { before: 5 },
      (error, updates) => {
        if (error != null) {
          throw error
        }
        expect(updates.updates[0].toV).to.equal(5)
        return done()
      }
    )
  })

  return it('should return the summarized updates from a before version at the end of a chunk', function (done) {
    MockHistoryStore()
      .get(`/api/projects/${this.historyId}/versions/6/history`)
      .replyWithFile(200, fixture('chunks/4-6.json'))
    return ProjectHistoryClient.getSummarizedUpdates(
      this.projectId,
      { before: 6 },
      (error, updates) => {
        if (error != null) {
          throw error
        }
        expect(updates.updates[0].toV).to.equal(6)
        return done()
      }
    )
  })
})
