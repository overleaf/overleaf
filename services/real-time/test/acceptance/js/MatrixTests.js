/*
This test suite is a multi level matrix which allows us to test many cases
 with all kinds of setups.

Users/Actors are defined in USERS and are a low level entity that does connect
 to a real-time pod. A typical UserItem is:

  someDescriptiveNameForTheTestSuite: {
    setup(cb) {
      // <setup session here>
      const options = { client: RealTimeClient.connect(), foo: 'bar' }
      cb(null, options)
    }
  }

Sessions are a set of actions that a User performs in the life-cycle of a
 real-time session, before they try something weird. A typical SessionItem is:

  someOtherDescriptiveNameForTheTestSuite: {
    getActions(cb) {
      cb(null, [
        { rpc: 'RPC_ENDPOINT', args: [...] }
      ])
    }
  }

Finally there are InvalidRequests which are the weird actions I hinted on in
 the Sessions section. The defined actions may be marked as 'failed' to denote
 that real-time rejects them with an (for this test) expected error.
 A typical InvalidRequestItem is:

  joinOwnProject: {
    getActions(cb) {
      cb(null, [
        { rpc: 'RPC_ENDPOINT', args: [...], failed: true }
      ])
    }
  }

There is additional meta-data that UserItems and SessionItems may use to skip
 certain areas of the matrix. Theses are:

- Has the User an own project that they join as part of the Session?
  UserItem: { hasOwnProject: true, setup(cb) { cb(null, { project_id, ... }) }}
  SessionItem: { needsOwnProject: true }
 */

const { expect } = require('chai')
const async = require('async')

const RealTimeClient = require('./helpers/RealTimeClient')
const FixturesManager = require('./helpers/FixturesManager')

const settings = require('@overleaf/settings')
const Keys = settings.redis.documentupdater.key_schema
const redis = require('@overleaf/redis-wrapper')
const rclient = redis.createClient(settings.redis.pubsub)

function getPendingUpdates(docId, cb) {
  rclient.lrange(Keys.pendingUpdates({ doc_id: docId }), 0, 10, cb)
}
function cleanupPreviousUpdates(docId, cb) {
  rclient.del(Keys.pendingUpdates({ doc_id: docId }), cb)
}

describe('MatrixTests', function () {
  let privateProjectId, privateDocId, readWriteProjectId, readWriteDocId

  let privateClient
  before(function setupPrivateProject(done) {
    FixturesManager.setUpEditorSession(
      { privilegeLevel: 'owner' },
      (err, { project_id: projectId, doc_id: docId }) => {
        if (err) return done(err)
        privateProjectId = projectId
        privateDocId = docId
        privateClient = RealTimeClient.connect()
        privateClient.on('connectionAccepted', () => {
          privateClient.emit(
            'joinProject',
            { project_id: privateProjectId },
            err => {
              if (err) return done(err)
              privateClient.emit('joinDoc', privateDocId, done)
            }
          )
        })
      }
    )
  })

  before(function setupReadWriteProject(done) {
    FixturesManager.setUpEditorSession(
      {
        publicAccess: 'readAndWrite',
      },
      (err, { project_id: projectId, doc_id: docId }) => {
        readWriteProjectId = projectId
        readWriteDocId = docId
        done(err)
      }
    )
  })

  const USER_SETUP = {
    anonymous: {
      setup(cb) {
        RealTimeClient.setSession({}, err => {
          if (err) return cb(err)
          cb(null, {
            client: RealTimeClient.connect(),
          })
        })
      },
    },

    registered: {
      setup(cb) {
        const userId = FixturesManager.getRandomId()
        RealTimeClient.setSession(
          {
            user: {
              _id: userId,
              first_name: 'Joe',
              last_name: 'Bloggs',
            },
          },
          err => {
            if (err) return cb(err)
            cb(null, {
              user_id: userId,
              client: RealTimeClient.connect(),
            })
          }
        )
      },
    },

    registeredWithOwnedProject: {
      setup(cb) {
        FixturesManager.setUpEditorSession(
          { privilegeLevel: 'owner' },
          (err, { project_id: projectId, user_id: userId, doc_id: docId }) => {
            if (err) return cb(err)
            cb(null, {
              user_id: userId,
              project_id: projectId,
              doc_id: docId,
              client: RealTimeClient.connect(),
            })
          }
        )
      },
      hasOwnProject: true,
    },
  }

  Object.entries(USER_SETUP).forEach(level0 => {
    const [userDescription, userItem] = level0
    let options, client

    const SESSION_SETUP = {
      noop: {
        getActions(cb) {
          cb(null, [])
        },
        needsOwnProject: false,
      },

      joinReadWriteProject: {
        getActions(cb) {
          cb(null, [
            { rpc: 'joinProject', args: [{ project_id: readWriteProjectId }] },
          ])
        },
        needsOwnProject: false,
      },

      joinReadWriteProjectAndDoc: {
        getActions(cb) {
          cb(null, [
            { rpc: 'joinProject', args: [{ project_id: readWriteProjectId }] },
            { rpc: 'joinDoc', args: [readWriteDocId] },
          ])
        },
        needsOwnProject: false,
      },

      joinOwnProject: {
        getActions(cb) {
          cb(null, [
            { rpc: 'joinProject', args: [{ project_id: options.project_id }] },
          ])
        },
        needsOwnProject: true,
      },

      joinOwnProjectAndDoc: {
        getActions(cb) {
          cb(null, [
            { rpc: 'joinProject', args: [{ project_id: options.project_id }] },
            { rpc: 'joinDoc', args: [options.doc_id] },
          ])
        },
        needsOwnProject: true,
      },
    }

    function performActions(getActions, done) {
      getActions((err, actions) => {
        if (err) return done(err)

        async.eachSeries(
          actions,
          (action, cb) => {
            if (action.rpc) {
              client.emit(action.rpc, ...action.args, (...returnedArgs) => {
                const error = returnedArgs.shift()
                if (action.fails) {
                  expect(error).to.exist
                  expect(returnedArgs).to.have.length(0)
                  return cb()
                }
                cb(error)
              })
            } else {
              cb(new Error('unexpected action'))
            }
          },
          done
        )
      })
    }

    describe(userDescription, function () {
      beforeEach(function userSetup(done) {
        userItem.setup((err, _options) => {
          if (err) return done(err)

          options = _options
          client = options.client
          client.on('connectionAccepted', done)
        })
      })

      Object.entries(SESSION_SETUP).forEach(level1 => {
        const [sessionSetupDescription, sessionSetupItem] = level1
        const INVALID_REQUESTS = {
          noop: {
            getActions(cb) {
              cb(null, [])
            },
          },

          joinProjectWithDocId: {
            getActions(cb) {
              cb(null, [
                {
                  rpc: 'joinProject',
                  args: [{ project_id: privateDocId }],
                  fails: 1,
                },
              ])
            },
          },

          joinDocWithDocId: {
            getActions(cb) {
              cb(null, [{ rpc: 'joinDoc', args: [privateDocId], fails: 1 }])
            },
          },

          joinProjectWithProjectId: {
            getActions(cb) {
              cb(null, [
                {
                  rpc: 'joinProject',
                  args: [{ project_id: privateProjectId }],
                  fails: 1,
                },
              ])
            },
          },

          joinDocWithProjectId: {
            getActions(cb) {
              cb(null, [{ rpc: 'joinDoc', args: [privateProjectId], fails: 1 }])
            },
          },

          joinProjectWithProjectIdThenJoinDocWithDocId: {
            getActions(cb) {
              cb(null, [
                {
                  rpc: 'joinProject',
                  args: [{ project_id: privateProjectId }],
                  fails: 1,
                },
                { rpc: 'joinDoc', args: [privateDocId], fails: 1 },
              ])
            },
          },
        }

        // skip some areas of the matrix
        // - some Users do not have an own project
        const skip = sessionSetupItem.needsOwnProject && !userItem.hasOwnProject

        describe(sessionSetupDescription, function () {
          beforeEach(function performSessionActions(done) {
            if (skip) return this.skip()
            performActions(sessionSetupItem.getActions, done)
          })

          Object.entries(INVALID_REQUESTS).forEach(level2 => {
            const [InvalidRequestDescription, InvalidRequestItem] = level2
            describe(InvalidRequestDescription, function () {
              beforeEach(function performInvalidRequests(done) {
                performActions(InvalidRequestItem.getActions, done)
              })

              describe('rooms', function () {
                it('should not add the user into the privateProject room', function (done) {
                  RealTimeClient.getConnectedClient(
                    client.socket.sessionid,
                    (error, client) => {
                      if (error) return done(error)
                      expect(client.rooms).to.not.include(privateProjectId)
                      done()
                    }
                  )
                })

                it('should not add the user into the privateDoc room', function (done) {
                  RealTimeClient.getConnectedClient(
                    client.socket.sessionid,
                    (error, client) => {
                      if (error) return done(error)
                      expect(client.rooms).to.not.include(privateDocId)
                      done()
                    }
                  )
                })
              })

              describe('receive updates', function () {
                const receivedMessages = []
                beforeEach(function publishAnUpdateInRedis(done) {
                  const update = {
                    doc_id: privateDocId,
                    op: {
                      meta: { source: privateClient.publicId },
                      v: 42,
                      doc: privateDocId,
                      op: [{ i: 'foo', p: 50 }],
                    },
                  }
                  client.on('otUpdateApplied', update => {
                    receivedMessages.push(update)
                  })
                  privateClient.once('otUpdateApplied', () => {
                    setTimeout(done, 10)
                  })
                  rclient.publish('applied-ops', JSON.stringify(update))
                })

                it('should send nothing to client', function () {
                  expect(receivedMessages).to.have.length(0)
                })
              })

              describe('receive messages from web', function () {
                const receivedMessages = []
                beforeEach(function publishAMessageInRedis(done) {
                  const event = {
                    room_id: privateProjectId,
                    message: 'removeEntity',
                    payload: ['foo', 'convertDocToFile'],
                    _id: 'web:123',
                  }
                  client.on('removeEntity', (...args) => {
                    receivedMessages.push(args)
                  })
                  privateClient.once('removeEntity', () => {
                    setTimeout(done, 10)
                  })
                  rclient.publish('editor-events', JSON.stringify(event))
                })

                it('should send nothing to client', function () {
                  expect(receivedMessages).to.have.length(0)
                })
              })

              describe('send updates', function () {
                let receivedArgs, submittedUpdates, update

                beforeEach(function cleanup(done) {
                  cleanupPreviousUpdates(privateDocId, done)
                })

                beforeEach(function setupUpdateFields() {
                  update = {
                    doc_id: privateDocId,
                    op: {
                      v: 43,
                      lastV: 42,
                      doc: privateDocId,
                      op: [{ i: 'foo', p: 50 }],
                    },
                  }
                })

                beforeEach(function sendAsUser(done) {
                  const userUpdate = Object.assign({}, update, {
                    hash: 'user',
                  })

                  client.emit(
                    'applyOtUpdate',
                    privateDocId,
                    userUpdate,
                    (...args) => {
                      receivedArgs = args
                      done()
                    }
                  )
                })

                beforeEach(function sendAsPrivateUserForReferenceOp(done) {
                  const privateUpdate = Object.assign({}, update, {
                    hash: 'private',
                  })

                  privateClient.emit(
                    'applyOtUpdate',
                    privateDocId,
                    privateUpdate,
                    done
                  )
                })

                beforeEach(function fetchPendingOps(done) {
                  getPendingUpdates(privateDocId, (err, updates) => {
                    submittedUpdates = updates
                    done(err)
                  })
                })

                it('should error out trying to send', function () {
                  expect(receivedArgs).to.have.length(1)
                  expect(receivedArgs[0]).to.have.property('message')
                  // we are using an old version of chai: 1.9.2
                  // TypeError: expect(...).to.be.oneOf is not a function
                  expect(
                    [
                      'no project_id found on client',
                      'not authorized',
                    ].includes(receivedArgs[0].message)
                  ).to.equal(true)
                })

                it('should submit the private users message only', function () {
                  expect(submittedUpdates).to.have.length(1)
                  const update = JSON.parse(submittedUpdates[0])
                  expect(update.hash).to.equal('private')
                })
              })
            })
          })
        })
      })
    })
  })
})
