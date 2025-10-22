const SandboxedModule = require('sandboxed-module')
const path = require('path')
const sinon = require('sinon')
const { expect } = require('chai')
const { RequestFailedError } = require('@overleaf/fetch-utils')

const MODULE_PATH = path.join(
  __dirname,
  '../../../../app/src/Features/Chat/ChatApiHandler'
)

describe('ChatApiHandler', function () {
  beforeEach(function () {
    this.settings = {
      apis: {
        chat: {
          internal_url: 'http://chat.overleaf.env',
        },
      },
    }
    this.FetchUtils = {
      fetchJson: sinon.stub(),
      fetchNothing: sinon.stub().resolves(),
    }
    this.ChatApiHandler = SandboxedModule.require(MODULE_PATH, {
      requires: {
        '@overleaf/settings': this.settings,
        '@overleaf/fetch-utils': this.FetchUtils,
      },
    })
    this.project_id = '3213213kl12j'
    this.user_id = '2k3jlkjs9'
    this.content = 'my message here'
  })

  describe('sendGlobalMessage', function () {
    describe('successfully', function () {
      beforeEach(async function () {
        this.message = { mock: 'message' }
        this.FetchUtils.fetchJson.resolves(this.message)
        this.result = await this.ChatApiHandler.promises.sendGlobalMessage(
          this.project_id,
          this.user_id,
          this.content
        )
      })

      it('should post the data to the chat api', function () {
        this.FetchUtils.fetchJson.should.have.been.calledWith(
          sinon.match(
            url =>
              url.toString() ===
              `${this.settings.apis.chat.internal_url}/project/${this.project_id}/messages`
          ),
          {
            method: 'POST',
            json: {
              content: this.content,
              user_id: this.user_id,
            },
          }
        )
      })

      it('should return the message from the post', function () {
        expect(this.result).to.deep.equal(this.message)
      })
    })

    describe('with a non-success status code', function () {
      beforeEach(async function () {
        this.error = new RequestFailedError('some-url', {}, { status: 500 })
        this.FetchUtils.fetchJson.rejects(this.error)
        await expect(
          this.ChatApiHandler.promises.sendGlobalMessage(
            this.project_id,
            this.user_id,
            this.content
          )
        ).to.be.rejectedWith(this.error)
      })
    })
  })

  describe('getGlobalMessages', function () {
    beforeEach(function () {
      this.messages = [{ mock: 'message' }]
      this.limit = 30
      this.before = '1234'
    })

    describe('successfully', function () {
      beforeEach(async function () {
        this.FetchUtils.fetchJson.resolves(this.messages)
        this.result = await this.ChatApiHandler.promises.getGlobalMessages(
          this.project_id,
          this.limit,
          this.before
        )
      })

      it('should make get request for room to chat api', function () {
        this.FetchUtils.fetchJson.should.have.been.calledWith(
          sinon.match(
            url =>
              url.toString() ===
              `${this.settings.apis.chat.internal_url}/project/${this.project_id}/messages?limit=${this.limit}&before=${this.before}`
          )
        )
      })

      it('should return the messages from the request', function () {
        expect(this.result).to.deep.equal(this.messages)
      })
    })

    describe('with failure error code', function () {
      beforeEach(async function () {
        this.error = new RequestFailedError('some-url', {}, { status: 500 })
        this.FetchUtils.fetchJson.rejects(this.error)
        await expect(
          this.ChatApiHandler.getGlobalMessages(
            this.project_id,
            this.limit,
            this.before
          )
        ).to.be.rejectedWith(this.error)
      })
    })
  })

  describe('duplicateCommentThreads', function () {
    beforeEach(async function () {
      this.FetchUtils.fetchJson.resolves(
        (this.mapping = {
          'comment-thread-1': 'comment-thread-1-dup',
          'comment-thread-2': 'comment-thread-2-dup',
          'comment-thread-3': 'comment-thread-3-dup',
        })
      )
      this.threads = [
        'comment-thread-1',
        'comment-thread-2',
        'comment-thread-3',
      ]
      this.result = await this.ChatApiHandler.promises.duplicateCommentThreads(
        this.project_id,
        this.threads
      )
    })

    it('should make a post request to the chat api', function () {
      expect(this.FetchUtils.fetchJson).to.have.been.calledWith(
        sinon.match(
          url =>
            url.toString() ===
            `${this.settings.apis.chat.internal_url}/project/${this.project_id}/duplicate-comment-threads`
        ),
        {
          method: 'POST',
          json: {
            threads: this.threads,
          },
        }
      )
    })

    it('should return the thread mapping', function () {
      expect(this.result).to.deep.equal(this.mapping)
    })
  })

  describe('generateThreadData', async function () {
    beforeEach(async function () {
      this.FetchUtils.fetchJson.resolves(
        (this.chatResponse = {
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
      this.threads = [
        'comment-thread-1',
        'comment-thread-2',
        'comment-thread-3',
      ]
      this.result = await this.ChatApiHandler.promises.generateThreadData(
        this.project_id,
        this.threads
      )
    })

    it('should make a post request to the chat api', function () {
      expect(this.FetchUtils.fetchJson).to.have.been.calledWith(
        sinon.match(
          url =>
            url.toString() ===
            `${this.settings.apis.chat.internal_url}/project/${this.project_id}/generate-thread-data`
        ),
        {
          method: 'POST',
          json: {
            threads: this.threads,
          },
        }
      )
    })

    it('should return the thread data', function () {
      expect(this.result).to.deep.equal(this.chatResponse)
    })
  })
})
