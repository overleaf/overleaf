import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { ProjectSnapshot } from '@/infrastructure/project-snapshot'

describe('ProjectSnapshot', function () {
  let snapshot: ProjectSnapshot
  const projectId = 'project-id'

  beforeEach(function () {
    snapshot = new ProjectSnapshot(projectId)
  })

  describe('before initialization', function () {
    describe('getDocPaths()', function () {
      it('returns an empty string', function () {
        expect(snapshot.getDocPaths()).to.deep.equal([])
      })
    })

    describe('getDocContents()', function () {
      it('returns null', function () {
        expect(snapshot.getDocContents('main.tex')).to.be.null
      })
    })
  })

  const files = {
    'main.tex': {
      contents: '\\documentclass{article}\netc.',
      hash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    },
    'hello.txt': {
      contents: 'Hello history!',
      hash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    },
    'goodbye.txt': {
      contents: "We're done here",
      hash: 'dddddddddddddddddddddddddddddddddddddddd',
    },
  }

  const chunk = {
    history: {
      snapshot: {
        files: {},
      },
      changes: [
        {
          operations: [
            {
              pathname: 'hello.txt',
              file: {
                hash: files['hello.txt'].hash,
                stringLength: files['hello.txt'].contents.length,
              },
            },
            {
              pathname: 'main.tex',
              file: {
                hash: files['main.tex'].hash,
                stringLength: files['main.tex'].contents.length,
              },
            },
            {
              pathname: 'frog.jpg',
              file: {
                hash: 'cccccccccccccccccccccccccccccccccccccccc',
                byteLength: 97080,
              },
            },
          ],
          timestamp: '2025-01-01T12:00:00.000Z',
        },
      ],
    },
    startVersion: 0,
  }

  const changes = [
    {
      operations: [
        {
          pathname: 'hello.txt',
          textOperation: ['Quote: ', files['hello.txt'].contents.length],
        },
        {
          pathname: 'goodbye.txt',
          file: {
            hash: files['goodbye.txt'].hash,
            stringLength: files['goodbye.txt'].contents.length,
          },
        },
      ],
      timestamp: '2025-01-01T13:00:00.000Z',
    },
  ]

  function mockFlush(
    opts: { repeat?: number; failOnCall?: (call: number) => boolean } = {}
  ) {
    let currentCall = 0
    const getResponse = () => {
      currentCall += 1
      return opts.failOnCall?.(currentCall) ? 500 : 200
    }

    fetchMock.post(`/project/${projectId}/flush`, getResponse, {
      name: 'flush',
      repeat: opts.repeat ?? 1,
    })
  }

  function mockLatestChunk() {
    fetchMock.getOnce(
      `/project/${projectId}/latest/history`,
      { chunk },
      { name: 'latest-chunk' }
    )
  }

  function mockChanges() {
    fetchMock.getOnce(`/project/${projectId}/changes?since=1`, changes, {
      name: 'changes-1',
    })
    fetchMock.get(`/project/${projectId}/changes?since=2`, [], {
      name: 'changes-2',
    })
  }

  function mockBlobs(paths = Object.keys(files) as (keyof typeof files)[]) {
    for (const path of paths) {
      const file = files[path]
      fetchMock.get(`/project/${projectId}/blob/${file.hash}`, file.contents)
    }
  }

  async function initializeSnapshot() {
    mockFlush()
    mockLatestChunk()
    mockBlobs(['main.tex', 'hello.txt'])
    await snapshot.refresh()
    fetchMock.reset()
  }

  describe('after initialization', function () {
    beforeEach(initializeSnapshot)

    describe('getDocPaths()', function () {
      it('returns the editable docs', function () {
        expect(snapshot.getDocPaths()).to.have.members([
          'main.tex',
          'hello.txt',
        ])
      })
    })

    describe('getDocContents()', function () {
      it('returns the doc contents', function () {
        expect(snapshot.getDocContents('main.tex')).to.equal(
          files['main.tex'].contents
        )
      })

      it('returns null for binary files', function () {
        expect(snapshot.getDocContents('frog.jpg')).to.be.null
      })

      it('returns null for inexistent files', function () {
        expect(snapshot.getDocContents('does-not-exist.txt')).to.be.null
      })
    })
  })

  async function refreshSnapshot() {
    mockFlush()
    mockChanges()
    mockBlobs(['goodbye.txt'])
    await snapshot.refresh()
    fetchMock.reset()
  }

  describe('after refresh', function () {
    beforeEach(initializeSnapshot)
    beforeEach(refreshSnapshot)

    afterEach(function () {
      fetchMock.reset()
    })

    describe('getDocPaths()', function () {
      it('returns the editable docs', function () {
        expect(snapshot.getDocPaths()).to.have.members([
          'main.tex',
          'hello.txt',
          'goodbye.txt',
        ])
      })
    })

    describe('getDocContents()', function () {
      it('returns the up to date content', function () {
        expect(snapshot.getDocContents('hello.txt')).to.equal(
          `Quote: ${files['hello.txt'].contents}`
        )
      })

      it('returns contents of new files', function () {
        expect(snapshot.getDocContents('goodbye.txt')).to.equal(
          files['goodbye.txt'].contents
        )
      })
    })
  })

  describe('concurrency', function () {
    afterEach(function () {
      fetchMock.reset()
    })

    specify('two concurrent inits', async function () {
      mockFlush({ repeat: 2 })
      mockLatestChunk()
      mockChanges()
      mockBlobs()

      await Promise.all([snapshot.refresh(), snapshot.refresh()])

      // The first request initializes, the second request loads changes
      expect(fetchMock.calls('flush')).to.have.length(2)
      expect(fetchMock.calls('latest-chunk')).to.have.length(1)
      expect(fetchMock.calls('changes-1')).to.have.length(1)
    })

    specify('three concurrent inits', async function () {
      mockFlush({ repeat: 2 })
      mockLatestChunk()
      mockChanges()
      mockBlobs()

      await Promise.all([
        snapshot.refresh(),
        snapshot.refresh(),
        snapshot.refresh(),
      ])

      // The first request initializes, the second and third are combined and
      // load changes
      expect(fetchMock.calls('flush')).to.have.length(2)
      expect(fetchMock.calls('latest-chunk')).to.have.length(1)
      expect(fetchMock.calls('changes-1')).to.have.length(1)
    })

    specify('two concurrent inits - first fails', async function () {
      mockFlush({ repeat: 2, failOnCall: call => call === 1 })
      mockLatestChunk()
      mockBlobs()

      const results = await Promise.allSettled([
        snapshot.refresh(),
        snapshot.refresh(),
      ])

      // The first init fails, but the second succeeds
      expect(results.filter(r => r.status === 'fulfilled')).to.have.length(1)
      expect(fetchMock.calls('flush')).to.have.length(2)
      expect(fetchMock.calls('latest-chunk')).to.have.length(1)
      expect(fetchMock.calls('changes-1')).to.have.length(0)
    })

    specify('three concurrent inits - second fails', async function () {
      mockFlush({ repeat: 4, failOnCall: call => call === 2 })
      mockLatestChunk()
      mockChanges()
      mockBlobs()

      const results = await Promise.allSettled([
        snapshot.refresh(),
        snapshot.refresh(),
        snapshot.refresh(),
      ])

      // Another request afterwards
      await snapshot.refresh()

      // The first init succeeds, the two queued requests fail, the last request
      // succeeds
      expect(results.filter(r => r.status === 'fulfilled')).to.have.length(1)
      expect(fetchMock.calls('flush')).to.have.length(3)
      expect(fetchMock.calls('latest-chunk')).to.have.length(1)
      expect(fetchMock.calls('changes-1')).to.have.length(1)
      expect(fetchMock.calls('changes-2')).to.have.length(0)
    })

    specify('two concurrent load changes', async function () {
      mockFlush({ repeat: 3 })
      mockLatestChunk()
      mockChanges()
      mockBlobs()

      // Initialize
      await snapshot.refresh()

      // Two concurrent load changes
      await Promise.all([snapshot.refresh(), snapshot.refresh()])

      // One init, two load changes
      expect(fetchMock.calls('flush')).to.have.length(3)
      expect(fetchMock.calls('latest-chunk')).to.have.length(1)
      expect(fetchMock.calls('changes-1')).to.have.length(1)
      expect(fetchMock.calls('changes-2')).to.have.length(1)
    })

    specify('three concurrent load changes', async function () {
      mockFlush({ repeat: 3 })
      mockLatestChunk()
      mockChanges()
      mockBlobs()

      // Initialize
      await snapshot.refresh()

      // Three concurrent load changes
      await Promise.all([
        snapshot.refresh(),
        snapshot.refresh(),
        snapshot.refresh(),
      ])

      // One init, two load changes (the two last are queued and combined)
      expect(fetchMock.calls('flush')).to.have.length(3)
      expect(fetchMock.calls('latest-chunk')).to.have.length(1)
      expect(fetchMock.calls('changes-1')).to.have.length(1)
      expect(fetchMock.calls('changes-2')).to.have.length(1)
    })

    specify('two concurrent load changes - first fails', async function () {
      mockFlush({ repeat: 3, failOnCall: call => call === 2 })
      mockLatestChunk()
      mockChanges()
      mockBlobs()

      // Initialize
      await snapshot.refresh()

      // Two concurrent load changes
      const results = await Promise.allSettled([
        snapshot.refresh(),
        snapshot.refresh(),
      ])

      // One init, one load changes fails, the second succeeds
      expect(results.filter(r => r.status === 'fulfilled')).to.have.length(1)
      expect(fetchMock.calls('flush')).to.have.length(3)
      expect(fetchMock.calls('latest-chunk')).to.have.length(1)
      expect(fetchMock.calls('changes-1')).to.have.length(1)
      expect(fetchMock.calls('changes-2')).to.have.length(0)
    })

    specify('three concurrent load changes - second fails', async function () {
      mockFlush({ repeat: 4, failOnCall: call => call === 3 })
      mockLatestChunk()
      mockChanges()
      mockBlobs()

      // Initialize
      await snapshot.refresh()

      // Two concurrent load changes
      const results = await Promise.allSettled([
        snapshot.refresh(),
        snapshot.refresh(),
        snapshot.refresh(),
      ])

      // Another request afterwards
      await snapshot.refresh()

      // One init, one load changes succeeds, the second and third are combined
      // and fail, the last request succeeds
      expect(results.filter(r => r.status === 'fulfilled')).to.have.length(1)
      expect(fetchMock.calls('flush')).to.have.length(4)
      expect(fetchMock.calls('latest-chunk')).to.have.length(1)
      expect(fetchMock.calls('changes-1')).to.have.length(1)
      expect(fetchMock.calls('changes-2')).to.have.length(1)
    })
  })
})
