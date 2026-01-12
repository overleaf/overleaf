import { vi, expect, describe, beforeEach, afterEach, it } from 'vitest'
import path from 'node:path'
import sinon from 'sinon'
import tk from 'timekeeper'

const modulePath = path.join(
  import.meta.dirname,
  '../../../app/js/ConnectedUsersManager'
)

describe('ConnectedUsersManager', function () {
  beforeEach(async function (ctx) {
    tk.freeze(new Date())
    ctx.settings = {
      redis: {
        realtime: {
          key_schema: {
            clientsInProject({ project_id: projectId }) {
              return `clients_in_project:${projectId}`
            },
            connectedUser({ project_id: projectId, client_id: clientId }) {
              return `connected_user:${projectId}:${clientId}`
            },
            projectNotEmptySince({ projectId }) {
              return `projectNotEmptySince:{${projectId}}`
            },
          },
        },
      },
    }
    ctx.rClient = {
      auth() {},
      getdel: sinon.stub(),
      scard: sinon.stub(),
      set: sinon.stub(),
      setex: sinon.stub(),
      sadd: sinon.stub(),
      get: sinon.stub(),
      srem: sinon.stub(),
      del: sinon.stub(),
      smembers: sinon.stub(),
      expire: sinon.stub(),
      hset: sinon.stub(),
      hgetall: sinon.stub(),
      exec: sinon.stub(),
      multi: () => {
        return ctx.rClient
      },
    }
    ctx.Metrics = {
      inc: sinon.stub(),
      histogram: sinon.stub(),
    }

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    vi.doMock('@overleaf/metrics', () => ({
      default: ctx.Metrics,
    }))

    vi.doMock('@overleaf/redis-wrapper', () => ({
      default: {
        createClient: () => {
          return ctx.rClient
        },
      },
    }))

    ctx.ConnectedUsersManager = (await import(modulePath)).default
    ctx.client_id = '32132132'
    ctx.project_id = 'dskjh2u21321'
    ctx.user = {
      _id: 'user-id-123',
      first_name: 'Joe',
      last_name: 'Bloggs',
      email: 'joe@example.com',
    }
    ctx.cursorData = {
      row: 12,
      column: 9,
      doc_id: '53c3b8c85fee64000023dc6e',
    }
  })

  afterEach(function () {
    tk.reset()
  })

  describe('updateUserPosition', function () {
    beforeEach(function (ctx) {
      ctx.rClient.exec.yields(null, [1, 1])
    })

    it('should set a key with the date and give it a ttl', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.ConnectedUsersManager.updateUserPosition(
          ctx.project_id,
          ctx.client_id,
          ctx.user,
          null,
          err => {
            if (err) return reject(err)
            ctx.rClient.hset
              .calledWith(
                `connected_user:${ctx.project_id}:${ctx.client_id}`,
                'last_updated_at',
                Date.now()
              )
              .should.equal(true)
            resolve()
          }
        )
      })
    })

    it('should set a key with the user_id', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.ConnectedUsersManager.updateUserPosition(
          ctx.project_id,
          ctx.client_id,
          ctx.user,
          null,
          err => {
            if (err) return reject(err)
            ctx.rClient.hset
              .calledWith(
                `connected_user:${ctx.project_id}:${ctx.client_id}`,
                'user_id',
                ctx.user._id
              )
              .should.equal(true)
            resolve()
          }
        )
      })
    })

    it('should set a key with the first_name', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.ConnectedUsersManager.updateUserPosition(
          ctx.project_id,
          ctx.client_id,
          ctx.user,
          null,
          err => {
            if (err) return reject(err)
            ctx.rClient.hset
              .calledWith(
                `connected_user:${ctx.project_id}:${ctx.client_id}`,
                'first_name',
                ctx.user.first_name
              )
              .should.equal(true)
            resolve()
          }
        )
      })
    })

    it('should set a key with the last_name', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.ConnectedUsersManager.updateUserPosition(
          ctx.project_id,
          ctx.client_id,
          ctx.user,
          null,
          err => {
            if (err) return reject(err)
            ctx.rClient.hset
              .calledWith(
                `connected_user:${ctx.project_id}:${ctx.client_id}`,
                'last_name',
                ctx.user.last_name
              )
              .should.equal(true)
            resolve()
          }
        )
      })
    })

    it('should set a key with the email', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.ConnectedUsersManager.updateUserPosition(
          ctx.project_id,
          ctx.client_id,
          ctx.user,
          null,
          err => {
            if (err) return reject(err)
            ctx.rClient.hset
              .calledWith(
                `connected_user:${ctx.project_id}:${ctx.client_id}`,
                'email',
                ctx.user.email
              )
              .should.equal(true)
            resolve()
          }
        )
      })
    })

    it('should push the client_id on to the project list', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.ConnectedUsersManager.updateUserPosition(
          ctx.project_id,
          ctx.client_id,
          ctx.user,
          null,
          err => {
            if (err) return reject(err)
            ctx.rClient.sadd
              .calledWith(`clients_in_project:${ctx.project_id}`, ctx.client_id)
              .should.equal(true)
            resolve()
          }
        )
      })
    })

    it('should add a ttl to the project set so it stays clean', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.ConnectedUsersManager.updateUserPosition(
          ctx.project_id,
          ctx.client_id,
          ctx.user,
          null,
          err => {
            if (err) return reject(err)
            ctx.rClient.expire
              .calledWith(
                `clients_in_project:${ctx.project_id}`,
                24 * 4 * 60 * 60
              )
              .should.equal(true)
            resolve()
          }
        )
      })
    })

    it('should add a ttl to the connected user so it stays clean', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.ConnectedUsersManager.updateUserPosition(
          ctx.project_id,
          ctx.client_id,
          ctx.user,
          null,
          err => {
            if (err) return reject(err)
            ctx.rClient.expire
              .calledWith(
                `connected_user:${ctx.project_id}:${ctx.client_id}`,
                60 * 15
              )
              .should.equal(true)
            resolve()
          }
        )
      })
    })

    it('should set the cursor position when provided', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.ConnectedUsersManager.updateUserPosition(
          ctx.project_id,
          ctx.client_id,
          ctx.user,
          ctx.cursorData,
          err => {
            if (err) return reject(err)
            ctx.rClient.hset
              .calledWith(
                `connected_user:${ctx.project_id}:${ctx.client_id}`,
                'cursorData',
                JSON.stringify(ctx.cursorData)
              )
              .should.equal(true)
            resolve()
          }
        )
      })
    })

    describe('editing_session_mode', function () {
      const cases = {
        'should bump the metric when connecting to empty room': {
          nConnectedClients: 1,
          cursorData: null,
          labels: {
            method: 'connect',
            status: 'single',
          },
        },
        'should bump the metric when connecting to non-empty room': {
          nConnectedClients: 2,
          cursorData: null,
          labels: {
            method: 'connect',
            status: 'multi',
          },
        },
        'should bump the metric when updating in empty room': {
          nConnectedClients: 1,
          cursorData: { row: 42 },
          labels: {
            method: 'update',
            status: 'single',
          },
        },
        'should bump the metric when updating in non-empty room': {
          nConnectedClients: 2,
          cursorData: { row: 42 },
          labels: {
            method: 'update',
            status: 'multi',
          },
        },
      }

      for (const [
        name,
        { nConnectedClients, cursorData, labels },
      ] of Object.entries(cases)) {
        it(name, async function (ctx) {
          await new Promise((resolve, reject) => {
            ctx.rClient.exec.yields(null, [1, nConnectedClients])
            ctx.ConnectedUsersManager.updateUserPosition(
              ctx.project_id,
              ctx.client_id,
              ctx.user,
              cursorData,
              err => {
                if (err) return reject(err)
                expect(ctx.Metrics.inc).to.have.been.calledWith(
                  'editing_session_mode',
                  1,
                  labels
                )
                resolve()
              }
            )
          })
        })
      }
    })
  })

  describe('markUserAsDisconnected', function () {
    beforeEach(function (ctx) {
      ctx.rClient.exec.yields(null, [1, 0])
    })

    it('should remove the user from the set', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.ConnectedUsersManager.markUserAsDisconnected(
          ctx.project_id,
          ctx.client_id,
          err => {
            if (err) return reject(err)
            ctx.rClient.srem
              .calledWith(`clients_in_project:${ctx.project_id}`, ctx.client_id)
              .should.equal(true)
            resolve()
          }
        )
      })
    })

    it('should delete the connected_user string', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.ConnectedUsersManager.markUserAsDisconnected(
          ctx.project_id,
          ctx.client_id,
          err => {
            if (err) return reject(err)
            ctx.rClient.del
              .calledWith(`connected_user:${ctx.project_id}:${ctx.client_id}`)
              .should.equal(true)
            resolve()
          }
        )
      })
    })

    it('should add a ttl to the connected user set so it stays clean', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.ConnectedUsersManager.markUserAsDisconnected(
          ctx.project_id,
          ctx.client_id,
          err => {
            if (err) return reject(err)
            ctx.rClient.expire
              .calledWith(
                `clients_in_project:${ctx.project_id}`,
                24 * 4 * 60 * 60
              )
              .should.equal(true)
            resolve()
          }
        )
      })
    })

    describe('editing_session_mode', function () {
      const cases = {
        'should bump the metric when disconnecting from now empty room': {
          nConnectedClients: 0,
          labels: {
            method: 'disconnect',
            status: 'empty',
          },
        },
        'should bump the metric when disconnecting from now single room': {
          nConnectedClients: 1,
          labels: {
            method: 'disconnect',
            status: 'single',
          },
        },
        'should bump the metric when disconnecting from now multi room': {
          nConnectedClients: 2,
          labels: {
            method: 'disconnect',
            status: 'multi',
          },
        },
      }

      for (const [name, { nConnectedClients, labels }] of Object.entries(
        cases
      )) {
        it(name, async function (ctx) {
          await new Promise((resolve, reject) => {
            ctx.rClient.exec.yields(null, [1, nConnectedClients])
            ctx.ConnectedUsersManager.markUserAsDisconnected(
              ctx.project_id,
              ctx.client_id,
              err => {
                if (err) return reject(err)
                expect(ctx.Metrics.inc).to.have.been.calledWith(
                  'editing_session_mode',
                  1,
                  labels
                )
                resolve()
              }
            )
          })
        })
      }
    })

    describe('projectNotEmptySince', function () {
      it('should clear the projectNotEmptySince key when empty and skip metric if not set', async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.rClient.exec.yields(null, [1, 0])
          ctx.rClient.getdel.yields(null, '')
          ctx.ConnectedUsersManager.markUserAsDisconnected(
            ctx.project_id,
            ctx.client_id,
            err => {
              if (err) return reject(err)
              expect(ctx.rClient.getdel).to.have.been.calledWith(
                `projectNotEmptySince:{${ctx.project_id}}`
              )
              expect(ctx.Metrics.histogram).to.not.have.been.called
              resolve()
            }
          )
        })
      })
      it('should clear the projectNotEmptySince key when empty and record metric if set', async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.rClient.exec.onFirstCall().yields(null, [1, 0])
          tk.freeze(1_234_000)
          ctx.rClient.getdel.yields(null, '1230')
          ctx.ConnectedUsersManager.markUserAsDisconnected(
            ctx.project_id,
            ctx.client_id,
            err => {
              if (err) return reject(err)
              expect(ctx.rClient.getdel).to.have.been.calledWith(
                `projectNotEmptySince:{${ctx.project_id}}`
              )
              expect(ctx.Metrics.histogram).to.have.been.calledWith(
                'project_not_empty_since',
                4,
                sinon.match.any,
                { status: 'empty' }
              )
              resolve()
            }
          )
        })
      })
      it('should set projectNotEmptySince key when single and skip metric if not set before', async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.rClient.exec.onFirstCall().yields(null, [1, 1])
          tk.freeze(1_233_001) // should ceil up
          ctx.rClient.exec.onSecondCall().yields(null, [''])
          ctx.ConnectedUsersManager.markUserAsDisconnected(
            ctx.project_id,
            ctx.client_id,
            err => {
              if (err) return reject(err)
              expect(ctx.rClient.set).to.have.been.calledWith(
                `projectNotEmptySince:{${ctx.project_id}}`,
                '1234',
                'NX',
                'EX',
                31 * 24 * 60 * 60
              )
              expect(ctx.Metrics.histogram).to.not.have.been.called
              resolve()
            }
          )
        })
      })
      const cases = {
        'should set projectNotEmptySince key when single and record metric if set before':
          {
            nConnectedClients: 1,
            labels: {
              status: 'single',
            },
          },
        'should set projectNotEmptySince key when multi and record metric if set before':
          {
            nConnectedClients: 2,
            labels: {
              status: 'multi',
            },
          },
      }
      for (const [name, { nConnectedClients, labels }] of Object.entries(
        cases
      )) {
        it(name, async function (ctx) {
          await new Promise((resolve, reject) => {
            ctx.rClient.exec.onFirstCall().yields(null, [1, nConnectedClients])
            tk.freeze(1_235_000)
            ctx.rClient.exec.onSecondCall().yields(null, ['1230'])
            ctx.ConnectedUsersManager.markUserAsDisconnected(
              ctx.project_id,
              ctx.client_id,
              err => {
                if (err) return reject(err)
                expect(ctx.rClient.set).to.have.been.calledWith(
                  `projectNotEmptySince:{${ctx.project_id}}`,
                  '1235',
                  'NX',
                  'EX',
                  31 * 24 * 60 * 60
                )
                expect(ctx.Metrics.histogram).to.have.been.calledWith(
                  'project_not_empty_since',
                  5,
                  sinon.match.any,
                  labels
                )
                resolve()
              }
            )
          })
        })
      }
    })
  })

  describe('_getConnectedUser', function () {
    it('should return a connected user if there is a user object', async function (ctx) {
      await new Promise((resolve, reject) => {
        const cursorData = JSON.stringify({ cursorData: { row: 1 } })
        ctx.rClient.hgetall.callsArgWith(1, null, {
          connected_at: new Date(),
          user_id: ctx.user._id,
          last_updated_at: `${Date.now()}`,
          cursorData,
        })
        ctx.ConnectedUsersManager._getConnectedUser(
          ctx.project_id,
          ctx.client_id,
          (err, result) => {
            if (err) return reject(err)
            result.connected.should.equal(true)
            result.client_id.should.equal(ctx.client_id)
            resolve()
          }
        )
      })
    })

    it('should return a not connected user if there is no object', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.rClient.hgetall.callsArgWith(1, null, null)
        ctx.ConnectedUsersManager._getConnectedUser(
          ctx.project_id,
          ctx.client_id,
          (err, result) => {
            if (err) return reject(err)
            result.connected.should.equal(false)
            result.client_id.should.equal(ctx.client_id)
            resolve()
          }
        )
      })
    })

    it('should return a not connected user if there is an empty object', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.rClient.hgetall.callsArgWith(1, null, {})
        ctx.ConnectedUsersManager._getConnectedUser(
          ctx.project_id,
          ctx.client_id,
          (err, result) => {
            if (err) return reject(err)
            result.connected.should.equal(false)
            result.client_id.should.equal(ctx.client_id)
            resolve()
          }
        )
      })
    })
  })

  describe('getConnectedUsers', function () {
    beforeEach(function (ctx) {
      ctx.users = ['1234', '5678', '9123', '8234']
      ctx.rClient.smembers.callsArgWith(1, null, ctx.users)
      ctx.ConnectedUsersManager._getConnectedUser = sinon.stub()
      ctx.ConnectedUsersManager._getConnectedUser
        .withArgs(ctx.project_id, ctx.users[0])
        .callsArgWith(2, null, {
          connected: true,
          client_age: 2,
          client_id: ctx.users[0],
        })
      ctx.ConnectedUsersManager._getConnectedUser
        .withArgs(ctx.project_id, ctx.users[1])
        .callsArgWith(2, null, {
          connected: false,
          client_age: 1,
          client_id: ctx.users[1],
        })
      ctx.ConnectedUsersManager._getConnectedUser
        .withArgs(ctx.project_id, ctx.users[2])
        .callsArgWith(2, null, {
          connected: true,
          client_age: 3,
          client_id: ctx.users[2],
        })
      ctx.ConnectedUsersManager._getConnectedUser
        .withArgs(ctx.project_id, ctx.users[3])
        .callsArgWith(2, null, {
          connected: true,
          client_age: 11,
          client_id: ctx.users[3],
        })
    }) // connected but old

    it('should only return the users in the list which are still in redis and recently updated', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.ConnectedUsersManager.getConnectedUsers(
          ctx.project_id,
          (err, users) => {
            if (err) return reject(err)
            users.length.should.equal(2)
            users[0].should.deep.equal({
              client_id: ctx.users[0],
              client_age: 2,
              connected: true,
            })
            users[1].should.deep.equal({
              client_id: ctx.users[2],
              client_age: 3,
              connected: true,
            })
            resolve()
          }
        )
      })
    })
  })
})
