// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import sinon from 'sinon'
import { describe, beforeEach, it } from 'vitest'
import path from 'node:path'
const modulePath = path.join(
  import.meta.dirname,
  '../../../app/js/DrainManager'
)

describe('DrainManager', function () {
  beforeEach(async function (ctx) {
    ctx.DrainManager = (await import(modulePath)).default
    ctx.io = {
      sockets: {
        clients: sinon.stub(),
      },
    }
  })

  describe('startDrainTimeWindow', function () {
    beforeEach(function (ctx) {
      ctx.clients = []
      for (let i = 0; i <= 5399; i++) {
        ctx.clients[i] = {
          id: i,
          emit: sinon.stub(),
        }
      }
      ctx.io.sockets.clients.returns(ctx.clients)
      ctx.DrainManager.startDrain = sinon.stub()
    })

    it('should set a drain rate fast enough', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.DrainManager.startDrainTimeWindow(ctx.io, 9)
        ctx.DrainManager.startDrain.calledWith(ctx.io, 10).should.equal(true)
        resolve()
      })
    })
  })

  describe('reconnectNClients', function () {
    beforeEach(function (ctx) {
      ctx.clients = []
      for (let i = 0; i <= 9; i++) {
        ctx.clients[i] = {
          id: i,
          emit: sinon.stub(),
        }
      }
      ctx.io.sockets.clients.returns(ctx.clients)
    })

    describe('after first pass', function () {
      beforeEach(function (ctx) {
        ctx.DrainManager.reconnectNClients(ctx.io, 3)
      })

      it('should reconnect the first 3 clients', function (ctx) {
        ;[0, 1, 2].map(i =>
          ctx.clients[i].emit
            .calledWith('reconnectGracefully')
            .should.equal(true)
        )
      })

      it('should not reconnect any more clients', function (ctx) {
        ;[3, 4, 5, 6, 7, 8, 9].map(i =>
          ctx.clients[i].emit
            .calledWith('reconnectGracefully')
            .should.equal(false)
        )
      })

      describe('after second pass', function () {
        beforeEach(function (ctx) {
          ctx.DrainManager.reconnectNClients(ctx.io, 3)
        })

        it('should reconnect the next 3 clients', function (ctx) {
          ;[3, 4, 5].map(i =>
            ctx.clients[i].emit
              .calledWith('reconnectGracefully')
              .should.equal(true)
          )
        })

        it('should not reconnect any more clients', function (ctx) {
          ;[6, 7, 8, 9].map(i =>
            ctx.clients[i].emit
              .calledWith('reconnectGracefully')
              .should.equal(false)
          )
        })

        it('should not reconnect the first 3 clients again', function (ctx) {
          ;[0, 1, 2].map(i => ctx.clients[i].emit.calledOnce.should.equal(true))
        })

        describe('after final pass', function () {
          beforeEach(function (ctx) {
            ctx.DrainManager.reconnectNClients(ctx.io, 100)
          })

          it('should not reconnect the first 6 clients again', function (ctx) {
            ;[0, 1, 2, 3, 4, 5].map(i =>
              ctx.clients[i].emit.calledOnce.should.equal(true)
            )
          })

          it('should log out that it reached the end', function (ctx) {
            ctx.logger.info
              .calledWith('All clients have been told to reconnectGracefully')
              .should.equal(true)
          })
        })
      })
    })
  })
})
