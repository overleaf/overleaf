import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { File } from 'overleaf-editor-core'
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
    'bibliography.bib': {
      contents:
        '@book{example2020,\n  title={An example book},\n  author={Doe, John},\n  year={2020},\n  publisher={Publisher}\n}\n'.repeat(
          60_000
        ), // 6.5MB
      hash: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    },
    'empty.png': {
      contents: '',
      hash: 'ffffffffffffffffffffffffffffffffffffffff',
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
            {
              pathname: 'bibliography.bib',
              file: {
                hash: files['bibliography.bib'].hash,
                byteLength: files['bibliography.bib'].contents.length,
              },
            },
            {
              pathname: 'empty.png',
              file: {
                hash: files['empty.png'].hash,
                byteLength: files['empty.png'].contents.length,
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
    fetchMock.getOnce(
      `/project/${projectId}/changes?since=1&paginated=true`,
      changes,
      {
        name: 'changes-1',
      }
    )
    fetchMock.get(`/project/${projectId}/changes?since=2&paginated=true`, [], {
      name: 'changes-2',
    })
  }

  // fetch-mock doesn't seem to expose the header to the response function,
  // so we just use a constant here
  const MOCKED_MAX_SIZE = 100

  function mockBlobs(paths = Object.keys(files) as (keyof typeof files)[]) {
    for (const path of paths) {
      const file = files[path]
      fetchMock
        .get({
          url: `/project/${projectId}/blob/${file.hash}`,
          missingHeaders: ['Range'],
          response: file.contents,
        })
        .get({
          url: `/project/${projectId}/blob/${file.hash}`,
          headers: { Range: `bytes=0-${MOCKED_MAX_SIZE - 1}` },
          response: file.contents.slice(0, MOCKED_MAX_SIZE),
        })
    }
  }

  async function initializeSnapshot() {
    mockFlush()
    mockLatestChunk()
    mockBlobs(['main.tex', 'hello.txt'])
    await snapshot.refresh()
    fetchMock.removeRoutes().clearHistory()
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
    fetchMock.removeRoutes().clearHistory()
  }

  describe('after refresh', function () {
    beforeEach(initializeSnapshot)
    beforeEach(refreshSnapshot)

    afterEach(function () {
      fetchMock.removeRoutes().clearHistory()
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

    describe('getBinaryFilePathsWithHash()', function () {
      it('returns the binary files', function () {
        const binaries = snapshot.getBinaryFilePathsWithHash()
        expect(binaries).to.deep.equal([
          {
            path: 'frog.jpg',
            hash: 'cccccccccccccccccccccccccccccccccccccccc',
            size: 97080,
          },
          {
            path: 'bibliography.bib',
            hash: files['bibliography.bib'].hash,
            size: files['bibliography.bib'].contents.length,
          },
          {
            path: 'empty.png',
            hash: 'ffffffffffffffffffffffffffffffffffffffff',
            size: 0,
          },
        ])
      })
    })

    describe('getBinaryFileContents', function () {
      beforeEach(function () {
        mockBlobs(['bibliography.bib', 'empty.png'])
      })

      it('can fetch whole file', async function () {
        const blob = await snapshot.getBinaryFileContents('bibliography.bib')
        expect(blob).to.equal(files['bibliography.bib'].contents)
      })

      it('can fetch part of file', async function () {
        const blob = await snapshot.getBinaryFileContents('bibliography.bib', {
          maxSize: MOCKED_MAX_SIZE,
        })
        expect(blob).to.equal(
          files['bibliography.bib'].contents.slice(0, MOCKED_MAX_SIZE)
        )
      })

      it('can fetch empty file with maxSize', async function () {
        const blob = await snapshot.getBinaryFileContents('empty.png', {
          maxSize: 200,
        })
        expect(blob).to.equal(files['empty.png'].contents)
      })
    })
  })

  describe('concurrency', function () {
    afterEach(function () {
      fetchMock.removeRoutes().clearHistory()
    })

    specify('two concurrent inits', async function () {
      mockFlush({ repeat: 2 })
      mockLatestChunk()
      mockChanges()
      mockBlobs()

      await Promise.all([snapshot.refresh(), snapshot.refresh()])

      // The first request initializes, the second request loads changes
      expect(fetchMock.callHistory.calls('flush')).to.have.length(2)
      expect(fetchMock.callHistory.calls('latest-chunk')).to.have.length(1)
      expect(fetchMock.callHistory.calls('changes-1')).to.have.length(1)
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
      expect(fetchMock.callHistory.calls('flush')).to.have.length(2)
      expect(fetchMock.callHistory.calls('latest-chunk')).to.have.length(1)
      expect(fetchMock.callHistory.calls('changes-1')).to.have.length(1)
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
      expect(fetchMock.callHistory.calls('flush')).to.have.length(2)
      expect(fetchMock.callHistory.calls('latest-chunk')).to.have.length(1)
      expect(fetchMock.callHistory.calls('changes-1')).to.have.length(0)
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
      expect(fetchMock.callHistory.calls('flush')).to.have.length(3)
      expect(fetchMock.callHistory.calls('latest-chunk')).to.have.length(1)
      expect(fetchMock.callHistory.calls('changes-1')).to.have.length(1)
      expect(fetchMock.callHistory.calls('changes-2')).to.have.length(0)
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
      expect(fetchMock.callHistory.calls('flush')).to.have.length(3)
      expect(fetchMock.callHistory.calls('latest-chunk')).to.have.length(1)
      expect(fetchMock.callHistory.calls('changes-1')).to.have.length(1)
      expect(fetchMock.callHistory.calls('changes-2')).to.have.length(1)
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
      expect(fetchMock.callHistory.calls('flush')).to.have.length(3)
      expect(fetchMock.callHistory.calls('latest-chunk')).to.have.length(1)
      expect(fetchMock.callHistory.calls('changes-1')).to.have.length(1)
      expect(fetchMock.callHistory.calls('changes-2')).to.have.length(1)
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
      expect(fetchMock.callHistory.calls('flush')).to.have.length(3)
      expect(fetchMock.callHistory.calls('latest-chunk')).to.have.length(1)
      expect(fetchMock.callHistory.calls('changes-1')).to.have.length(1)
      expect(fetchMock.callHistory.calls('changes-2')).to.have.length(0)
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
      expect(fetchMock.callHistory.calls('flush')).to.have.length(4)
      expect(fetchMock.callHistory.calls('latest-chunk')).to.have.length(1)
      expect(fetchMock.callHistory.calls('changes-1')).to.have.length(1)
      expect(fetchMock.callHistory.calls('changes-2')).to.have.length(1)
    })
  })

  describe('blob with UTF-8 BOM', function () {
    // Files uploaded from Windows editors often have a UTF-8 BOM (U+FEFF) at
    // the start. The server stores the blob as-is and counts the BOM in
    // stringLength. TextOperations are built against that length.
    //
    // Response.text() strips the BOM per the Encoding spec, making the content
    // 1 char shorter than expected — causing ApplyError on every page load.
    // The fix uses arrayBuffer() + TextDecoder({ ignoreBOM: true }) to preserve
    // the BOM, matching how the server counts stringLength.

    const bomHash = '1111111111111111111111111111111111111111'
    const bomHash2 = '2222222222222222222222222222222222222222'
    const noBomHash = '3333333333333333333333333333333333333333'

    const bomContent = '\uFEFF@article{Test2020,\n  author = {Smith, J},\n}\n'
    const bomContent2 = '\uFEFF@article{Other2021,\n  author = {Jones, A},\n}\n'
    const noBomContent = '@article{NoBom2022,\n  author = {Lee, B},\n}\n'

    afterEach(function () {
      fetchMock.removeRoutes().clearHistory()
    })

    it('loads a doc whose blob starts with a UTF-8 BOM', async function () {
      // The main production bug: upload a BOM file, make one edit, reload.
      const insertedText = '% comment\n'
      const bomChunk = {
        history: {
          snapshot: { files: {} },
          changes: [
            {
              operations: [
                {
                  pathname: 'refs.bib',
                  file: { hash: bomHash, stringLength: bomContent.length },
                },
              ],
              timestamp: '2025-01-01T12:00:00.000Z',
            },
            {
              operations: [
                {
                  pathname: 'refs.bib',
                  // baseLength includes BOM — matches server stringLength
                  textOperation: [bomContent.length, insertedText],
                },
              ],
              timestamp: '2025-01-01T12:01:00.000Z',
            },
          ],
        },
        startVersion: 0,
      }

      fetchMock.post(`/project/${projectId}/flush`, 200)
      fetchMock.getOnce(`/project/${projectId}/latest/history`, {
        chunk: bomChunk,
      })
      fetchMock.get(`/project/${projectId}/blob/${bomHash}`, bomContent)

      await snapshot.refresh()

      expect(snapshot.getDocContents('refs.bib')).to.equal(
        bomContent + insertedText
      )
    })

    it('loads multiple BOM files in the same project', async function () {
      const insert1 = '% first\n'
      const insert2 = '% second\n'
      const bomChunk = {
        history: {
          snapshot: { files: {} },
          changes: [
            {
              operations: [
                {
                  pathname: 'refs1.bib',
                  file: { hash: bomHash, stringLength: bomContent.length },
                },
                {
                  pathname: 'refs2.bib',
                  file: { hash: bomHash2, stringLength: bomContent2.length },
                },
              ],
              timestamp: '2025-01-01T12:00:00.000Z',
            },
            {
              operations: [
                {
                  pathname: 'refs1.bib',
                  textOperation: [bomContent.length, insert1],
                },
                {
                  pathname: 'refs2.bib',
                  textOperation: [bomContent2.length, insert2],
                },
              ],
              timestamp: '2025-01-01T12:01:00.000Z',
            },
          ],
        },
        startVersion: 0,
      }

      fetchMock.post(`/project/${projectId}/flush`, 200)
      fetchMock.getOnce(`/project/${projectId}/latest/history`, {
        chunk: bomChunk,
      })
      fetchMock.get(`/project/${projectId}/blob/${bomHash}`, bomContent)
      fetchMock.get(`/project/${projectId}/blob/${bomHash2}`, bomContent2)

      await snapshot.refresh()

      expect(snapshot.getDocContents('refs1.bib')).to.equal(
        bomContent + insert1
      )
      expect(snapshot.getDocContents('refs2.bib')).to.equal(
        bomContent2 + insert2
      )
    })

    it('loads a BOM file with multiple accumulated textOps', async function () {
      // Multiple edits accumulate in the lazy operations list before toEager
      // is called. All ops use BOM-inclusive baseLengths.
      const bomChunk = {
        history: {
          snapshot: { files: {} },
          changes: [
            {
              operations: [
                {
                  pathname: 'refs.bib',
                  file: { hash: bomHash, stringLength: bomContent.length },
                },
              ],
              timestamp: '2025-01-01T12:00:00.000Z',
            },
            {
              operations: [
                {
                  pathname: 'refs.bib',
                  // first edit: insert text at end
                  textOperation: [bomContent.length, '% edit1\n'],
                },
              ],
              timestamp: '2025-01-01T12:01:00.000Z',
            },
            {
              operations: [
                {
                  pathname: 'refs.bib',
                  // second edit: insert more text at end
                  textOperation: [
                    bomContent.length + '% edit1\n'.length,
                    '% edit2\n',
                  ],
                },
              ],
              timestamp: '2025-01-01T12:02:00.000Z',
            },
          ],
        },
        startVersion: 0,
      }

      fetchMock.post(`/project/${projectId}/flush`, 200)
      fetchMock.getOnce(`/project/${projectId}/latest/history`, {
        chunk: bomChunk,
      })
      fetchMock.get(`/project/${projectId}/blob/${bomHash}`, bomContent)

      await snapshot.refresh()

      expect(snapshot.getDocContents('refs.bib')).to.equal(
        bomContent + '% edit1\n' + '% edit2\n'
      )
    })

    it('does not affect files without a BOM', async function () {
      // BOM handling is per-file; non-BOM files must not be broken.
      const insertedText = '% added\n'
      const mixedChunk = {
        history: {
          snapshot: { files: {} },
          changes: [
            {
              operations: [
                {
                  pathname: 'bom.bib',
                  file: { hash: bomHash, stringLength: bomContent.length },
                },
                {
                  pathname: 'nobom.bib',
                  file: {
                    hash: noBomHash,
                    stringLength: noBomContent.length,
                  },
                },
              ],
              timestamp: '2025-01-01T12:00:00.000Z',
            },
            {
              operations: [
                {
                  pathname: 'bom.bib',
                  textOperation: [bomContent.length, insertedText],
                },
                {
                  pathname: 'nobom.bib',
                  textOperation: [noBomContent.length, insertedText],
                },
              ],
              timestamp: '2025-01-01T12:01:00.000Z',
            },
          ],
        },
        startVersion: 0,
      }

      fetchMock.post(`/project/${projectId}/flush`, 200)
      fetchMock.getOnce(`/project/${projectId}/latest/history`, {
        chunk: mixedChunk,
      })
      fetchMock.get(`/project/${projectId}/blob/${bomHash}`, bomContent)
      fetchMock.get(`/project/${projectId}/blob/${noBomHash}`, noBomContent)

      await snapshot.refresh()

      expect(snapshot.getDocContents('bom.bib')).to.equal(
        bomContent + insertedText
      )
      expect(snapshot.getDocContents('nobom.bib')).to.equal(
        noBomContent + insertedText
      )
    })
  })

  describe('blob with the hash of empty content', function () {
    // Nothing is stored under that hash, on the server or here, so the content is
    // answered from the hash rather than fetched. A new empty doc references it before
    // anything has written it, so a fetch would 404 and take the whole snapshot down.

    afterEach(function () {
      fetchMock.removeRoutes().clearHistory()
    })

    it('loads an empty doc without fetching the blob', async function () {
      const emptyChunk = {
        history: {
          snapshot: { files: {} },
          changes: [
            {
              operations: [
                {
                  pathname: 'fresh.tex',
                  file: { hash: File.EMPTY_FILE_HASH, stringLength: 0 },
                },
              ],
              timestamp: '2025-01-01T12:00:00.000Z',
            },
          ],
        },
        startVersion: 0,
      }

      fetchMock.post(`/project/${projectId}/flush`, 200)
      fetchMock.getOnce(`/project/${projectId}/latest/history`, {
        chunk: emptyChunk,
      })
      // Served only if the short circuit does not answer first, in which case the
      // content below is what comes back.
      fetchMock.get(
        `/project/${projectId}/blob/${File.EMPTY_FILE_HASH}`,
        'fetched from the server'
      )

      await snapshot.refresh()

      expect(snapshot.getDocPaths()).to.have.members(['fresh.tex'])
      expect(snapshot.getDocContents('fresh.tex')).to.equal('')
    })

    it('applies edits made on top of an empty doc', async function () {
      const insertedText = '\\documentclass{article}\n'
      const emptyChunk = {
        history: {
          snapshot: { files: {} },
          changes: [
            {
              operations: [
                {
                  pathname: 'fresh.tex',
                  file: { hash: File.EMPTY_FILE_HASH, stringLength: 0 },
                },
              ],
              timestamp: '2025-01-01T12:00:00.000Z',
            },
            {
              operations: [
                { pathname: 'fresh.tex', textOperation: [insertedText] },
              ],
              timestamp: '2025-01-01T12:01:00.000Z',
            },
          ],
        },
        startVersion: 0,
      }

      fetchMock.post(`/project/${projectId}/flush`, 200)
      fetchMock.getOnce(`/project/${projectId}/latest/history`, {
        chunk: emptyChunk,
      })
      fetchMock.get(
        `/project/${projectId}/blob/${File.EMPTY_FILE_HASH}`,
        'fetched from the server'
      )

      await snapshot.refresh()

      expect(snapshot.getDocContents('fresh.tex')).to.equal(insertedText)
    })
  })
})
