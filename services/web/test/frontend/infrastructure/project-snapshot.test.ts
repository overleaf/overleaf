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

  async function initializeSnapshot() {
    fetchMock.postOnce(`/project/${projectId}/flush`, 200)
    fetchMock.getOnce(`/project/${projectId}/latest/history`, { chunk })
    fetchMock.getOnce(
      `/project/${projectId}/blob/${files['main.tex'].hash}`,
      files['main.tex'].contents
    )
    fetchMock.getOnce(
      `/project/${projectId}/blob/${files['hello.txt'].hash}`,
      files['hello.txt'].contents
    )
    await snapshot.refresh()
    expect(fetchMock.done()).to.be.true
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

  async function refreshSnapshot() {
    fetchMock.postOnce(`/project/${projectId}/flush`, 200, { repeat: 2 })
    fetchMock.getOnce(`/project/${projectId}/changes?since=1`, changes)
    fetchMock.getOnce(
      `/project/${projectId}/blob/${files['goodbye.txt'].hash}`,
      files['goodbye.txt'].contents
    )
    await snapshot.refresh()
    expect(fetchMock.done()).to.be.true
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

    describe('getDocCotents()', function () {
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
})
