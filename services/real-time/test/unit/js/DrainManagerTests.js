/* eslint-disable
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const SandboxedModule = require('sandboxed-module')
const path = require('node:path')
const modulePath = path.join(__dirname, '../../../app/js/DrainManager')

describe('DrainManager', function () {
  beforeEach(function () {
    this.DrainManager = SandboxedModule.require(modulePath, {})
    return (this.io = {
      sockets: {
        clients: sinon.stub(),
      },
    })
  })

  describe('startDrainTimeWindow', function () {
    beforeEach(function () {
      this.clients = []
      for (let i = 0; i <= 5399; i++) {
        this.clients[i] = {
          id: i,
          emit: sinon.stub(),
        }
      }
      this.io.sockets.clients.returns(this.clients)
      return (this.DrainManager.startDrain = sinon.stub())
    })

    return it('should set a drain rate fast enough', function (done) {
      this.DrainManager.startDrainTimeWindow(this.io, 9)
      this.DrainManager.startDrain.calledWith(this.io, 10).should.equal(true)
      return done()
    })
  })

  return describe('reconnectNClients', function () {
    beforeEach(function () {
      this.clients = []
      for (let i = 0; i <= 9; i++) {
        this.clients[i] = {
          id: i,
          emit: sinon.stub(),
        }
      }
      return this.io.sockets.clients.returns(this.clients)
    })

    return describe('after first pass', function () {
      beforeEach(function () {
        return this.DrainManager.reconnectNClients(this.io, 3)
      })

      it('should reconnect the first 3 clients', function () {
        return [0, 1, 2].map(i =>
          this.clients[i].emit
            .calledWith('reconnectGracefully')
            .should.equal(true)
        )
      })

      it('should not reconnect any more clients', function () {
        return [3, 4, 5, 6, 7, 8, 9].map(i =>
          this.clients[i].emit
            .calledWith('reconnectGracefully')
            .should.equal(false)
        )
      })

      return describe('after second pass', function () {
        beforeEach(function () {
          return this.DrainManager.reconnectNClients(this.io, 3)
        })

        it('should reconnect the next 3 clients', function () {
          return [3, 4, 5].map(i =>
            this.clients[i].emit
              .calledWith('reconnectGracefully')
              .should.equal(true)
          )
        })

        it('should not reconnect any more clients', function () {
          return [6, 7, 8, 9].map(i =>
            this.clients[i].emit
              .calledWith('reconnectGracefully')
              .should.equal(false)
          )
        })

        it('should not reconnect the first 3 clients again', function () {
          return [0, 1, 2].map(i =>
            this.clients[i].emit.calledOnce.should.equal(true)
          )
        })

        return describe('after final pass', function () {
          beforeEach(function () {
            return this.DrainManager.reconnectNClients(this.io, 100)
          })

          it('should not reconnect the first 6 clients again', function () {
            return [0, 1, 2, 3, 4, 5].map(i =>
              this.clients[i].emit.calledOnce.should.equal(true)
            )
          })

          return it('should log out that it reached the end', function () {
            return this.logger.info
              .calledWith('All clients have been told to reconnectGracefully')
              .should.equal(true)
          })
        })
      })
    })
  })
})
