import { vi, expect } from 'vitest'
import path from 'node:path'
import sinon from 'sinon'
import { RequestFailedError } from '@overleaf/fetch-utils'

const MODULE_PATH = path.join(
  import.meta.dirname,
  '../../../../app/src/Features/Chat/ChatApiHandler'
)

describe('ChatApiHandler', function () {
  beforeEach(async function (ctx) {
    ctx.settings = {
      apis: {
        chat: {
          internal_url: 'http://chat.overleaf.env',
        },
      },
    }
    ctx.FetchUtils = {
      fetchJson: sinon.stub(),
      fetchNothing: sinon.stub().resolves(),
    }

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    vi.doMock('@overleaf/fetch-utils', () => ctx.FetchUtils)

    ctx.ChatApiHandler = (await import(MODULE_PATH)).default
    ctx.project_id = '3213213kl12j'
    ctx.user_id = '2k3jlkjs9'
    ctx.content = 'my message here'
  })

  describe('sendGlobalMessage', function () {
    describe('successfully', function () {
      beforeEach(async function (ctx) {
        ctx.message = { mock: 'message' }
        ctx.FetchUtils.fetchJson.resolves(ctx.message)
        ctx.result = await ctx.ChatApiHandler.promises.sendGlobalMessage(
          ctx.project_id,
          ctx.user_id,
          ctx.content
        )
      })

      it('should post the data to the chat api', function (ctx) {
        ctx.FetchUtils.fetchJson.should.have.been.calledWith(
          sinon.match(
            url =>
              url.toString() ===
              `${ctx.settings.apis.chat.internal_url}/project/${ctx.project_id}/messages`
          ),
          {
            method: 'POST',
            json: {
              content: ctx.content,
              user_id: ctx.user_id,
            },
          }
        )
      })

      it('should return the message from the post', function (ctx) {
        expect(ctx.result).to.deep.equal(ctx.message)
      })
    })

    describe('with a non-success status code', function () {
      beforeEach(async function (ctx) {
        ctx.error = new RequestFailedError('some-url', {}, { status: 500 })
        ctx.FetchUtils.fetchJson.rejects(ctx.error)
      })

      it('should throw the error', async function (ctx) {
        await expect(
          ctx.ChatApiHandler.promises.sendGlobalMessage(
            ctx.project_id,
            ctx.user_id,
            ctx.content
          )
        ).to.be.rejectedWith(ctx.error)
      })
    })
  })

  describe('getGlobalMessages', function () {
    beforeEach(function (ctx) {
      ctx.messages = [{ mock: 'message' }]
      ctx.limit = 30
      ctx.before = '1234'
    })

    describe('successfully', function () {
      beforeEach(async function (ctx) {
        ctx.FetchUtils.fetchJson.resolves(ctx.messages)
        ctx.result = await ctx.ChatApiHandler.promises.getGlobalMessages(
          ctx.project_id,
          ctx.limit,
          ctx.before
        )
      })

      it('should make get request for room to chat api', function (ctx) {
        ctx.FetchUtils.fetchJson.should.have.been.calledWith(
          sinon.match(
            url =>
              url.toString() ===
              `${ctx.settings.apis.chat.internal_url}/project/${ctx.project_id}/messages?limit=${ctx.limit}&before=${ctx.before}`
          )
        )
      })

      it('should return the messages from the request', function (ctx) {
        expect(ctx.result).to.deep.equal(ctx.messages)
      })
    })

    describe('with failure error code', function () {
      beforeEach(function (ctx) {
        ctx.error = new RequestFailedError('some-url', {}, { status: 500 })
        ctx.FetchUtils.fetchJson.rejects(ctx.error)
      })

      it('should throw the error', async function (ctx) {
        await expect(
          ctx.ChatApiHandler.promises.getGlobalMessages(
            ctx.project_id,
            ctx.limit,
            ctx.before
          )
        ).to.be.rejectedWith(ctx.error)
      })
    })
  })

  describe('duplicateCommentThreads', function () {
    beforeEach(async function (ctx) {
      ctx.FetchUtils.fetchJson.resolves(
        (ctx.mapping = {
          'comment-thread-1': 'comment-thread-1-dup',
          'comment-thread-2': 'comment-thread-2-dup',
          'comment-thread-3': 'comment-thread-3-dup',
        })
      )
      ctx.threads = ['comment-thread-1', 'comment-thread-2', 'comment-thread-3']
      ctx.result = await ctx.ChatApiHandler.promises.duplicateCommentThreads(
        ctx.project_id,
        ctx.threads
      )
    })

    it('should make a post request to the chat api', function (ctx) {
      expect(ctx.FetchUtils.fetchJson).to.have.been.calledWith(
        sinon.match(
          url =>
            url.toString() ===
            `${ctx.settings.apis.chat.internal_url}/project/${ctx.project_id}/duplicate-comment-threads`
        ),
        {
          method: 'POST',
          json: {
            threads: ctx.threads,
          },
        }
      )
    })

    it('should return the thread mapping', function (ctx) {
      expect(ctx.result).to.deep.equal(ctx.mapping)
    })
  })

  describe('generateThreadData', async function () {
    beforeEach(async function (ctx) {
      ctx.FetchUtils.fetchJson.resolves(
        (ctx.chatResponse = {
          'comment-thread-1': {
            messages: [
              {
                content: 'message 1',
                timestamp: '2024-01-01T00:00:00.000Z',
                user_id: 'user-1',
              },
            ],
          },
          'comment-thread-2': {
            messages: [
              {
                content: 'message 2',
                timestamp: '2024-01-01T00:00:00.000Z',
                user_id: 'user-2',
              },
            ],
          },
        })
      )
      // Chat won't return threads that couldn't be found, so response can have
      // fewer threads
      ctx.threads = ['comment-thread-1', 'comment-thread-2', 'comment-thread-3']
      ctx.result = await ctx.ChatApiHandler.promises.generateThreadData(
        ctx.project_id,
        ctx.threads
      )
    })

    it('should make a post request to the chat api', function (ctx) {
      expect(ctx.FetchUtils.fetchJson).to.have.been.calledWith(
        sinon.match(
          url =>
            url.toString() ===
            `${ctx.settings.apis.chat.internal_url}/project/${ctx.project_id}/generate-thread-data`
        ),
        {
          method: 'POST',
          json: {
            threads: ctx.threads,
          },
        }
      )
    })

    it('should return the thread data', function (ctx) {
      expect(ctx.result).to.deep.equal(ctx.chatResponse)
    })
  })
})
