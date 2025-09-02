import { ReferenceIndexer } from '@/features/ide-react/references/reference-indexer'
import { generateMD5Hash } from '@/shared/utils/md5'
import sinon from 'sinon'

const entry1 = `@article{sample2023,
  author = {John Doe},
  title = {Sample Title},
  journal = {Sample Journal},
  year = {2023},
  date = {2023-01-01}
}`

const entry2 = `@book{example2022,
  author = {Jane Smith},
  title = {Example Book},
  journal = {Example Journal},
  year = {2022}
  date = {2022-05-15}
}`

const entry3 = `@article{sample2024,
  author = {John Doe},
  title = {Sample Title},
  journal = {Sample Journal},
  year = {2024},
  date = {2024-01-01}
}`

const entry4 = `@book{example2025,
  author = {Jane Smith},
  title = {Example Book},
  journal = {Example Journal},
  year = {2025}
  date = {2025-05-15}
}`

const snapshotWithData = ({
  docs,
  files,
}: {
  docs?: Record<string, string>
  files?: Record<string, string>
}) => {
  return {
    getDocPaths: sinon.spy(() => Object.keys(docs ?? {})),
    getDocContents: sinon.spy(path => (docs ? (docs[path] ?? null) : null)),
    getBinaryFilePathsWithHash: sinon.spy(() => {
      return Object.entries(files ?? {}).map(([path, content]) => ({
        path,
        hash: generateMD5Hash(content),
        size: content.length,
      }))
    }),
    getBinaryFileContents: sinon.spy(async path =>
      files ? (files[path] ?? null) : null
    ),
  }
}

const IGNORED_SIGNAL = new AbortController().signal

describe('ReferenceIndexer', function () {
  it('it should index bib docs', async function () {
    const referencer = new ReferenceIndexer()
    const snapshot = snapshotWithData({
      docs: {
        'refs.bib': entry1,
        'refs2.bib': entry2,
        'other.tex': 'Not a bib file',
      },
    })
    const result = await referencer.updateFromSnapshot(snapshot, {
      signal: IGNORED_SIGNAL,
    })
    expect(snapshot.getDocPaths).to.have.been.calledOnce
    expect(snapshot.getDocContents).to.have.been.calledTwice
    expect(snapshot.getDocContents).to.have.been.calledWith('refs.bib')
    expect(snapshot.getDocContents).to.have.been.calledWith('refs2.bib')
    expect(snapshot.getDocContents).to.not.have.been.calledWith('other.tex')
    expect(snapshot.getBinaryFileContents).to.not.have.been.called
    expect(result).to.deep.equal(new Set(['sample2023', 'example2022']))
  })

  it('it should index bib binary files', async function () {
    const referencer = new ReferenceIndexer()
    const snapshot = snapshotWithData({
      files: {
        'refs.bib': entry1,
        'refs2.bib': entry2,
        'image.png': 'Not a bib file',
      },
    })
    const result = await referencer.updateFromSnapshot(snapshot, {
      signal: IGNORED_SIGNAL,
    })
    expect(snapshot.getDocPaths).to.have.been.calledOnce
    expect(snapshot.getDocContents).to.not.have.been.called
    expect(snapshot.getBinaryFilePathsWithHash).to.have.been.calledOnce
    expect(snapshot.getBinaryFileContents).to.have.been.calledTwice
    expect(snapshot.getBinaryFileContents).to.have.been.calledWith('refs.bib')
    expect(snapshot.getBinaryFileContents).to.have.been.calledWith('refs2.bib')
    expect(snapshot.getBinaryFileContents).to.not.have.been.calledWith(
      'image.png'
    )
    expect(result).to.deep.equal(new Set(['sample2023', 'example2022']))
  })

  it('it should index both bib docs and binary files', async function () {
    const referencer = new ReferenceIndexer()
    const snapshot = snapshotWithData({
      docs: {
        'refs.bib': entry1,
        'other.tex': 'Not a bib file',
      },
      files: {
        'refs2.bib': entry2,
        'image.png': 'Not a bib file',
      },
    })
    const result = await referencer.updateFromSnapshot(snapshot, {
      signal: IGNORED_SIGNAL,
    })
    expect(snapshot.getDocPaths).to.have.been.calledOnce
    expect(snapshot.getDocContents).to.have.been.calledOnce
    expect(snapshot.getDocContents).to.have.been.calledWith('refs.bib')
    expect(snapshot.getDocContents).to.not.have.been.calledWith('other.tex')
    expect(snapshot.getBinaryFilePathsWithHash).to.have.been.calledOnce
    expect(snapshot.getBinaryFileContents).to.have.been.calledOnce
    expect(snapshot.getBinaryFileContents).to.have.been.calledWith('refs2.bib')
    expect(snapshot.getBinaryFileContents).to.not.have.been.calledWith(
      'image.png'
    )
    expect(result).to.deep.equal(new Set(['sample2023', 'example2022']))
  })

  it('should not fetch binary files if unchanged', async function () {
    const referencer = new ReferenceIndexer()
    const initialSnapshot = snapshotWithData({
      files: {
        'refs.bib': entry1,
      },
    })
    const initialResult = await referencer.updateFromSnapshot(initialSnapshot, {
      signal: IGNORED_SIGNAL,
    })
    expect(initialSnapshot.getDocPaths).to.have.been.calledOnce
    expect(initialSnapshot.getBinaryFilePathsWithHash).to.have.been.calledOnce
    expect(initialSnapshot.getBinaryFileContents).to.have.been.calledOnceWith(
      'refs.bib'
    )
    expect(initialResult).to.deep.equal(new Set(['sample2023']))

    // Second snapshot with same files, should not fetch contents again
    const secondSnapshot = snapshotWithData({
      files: {
        'refs.bib': entry1,
      },
    })
    const secondResult = await referencer.updateFromSnapshot(secondSnapshot, {
      signal: IGNORED_SIGNAL,
    })
    expect(secondSnapshot.getDocPaths).to.have.been.calledOnce
    expect(secondSnapshot.getBinaryFilePathsWithHash).to.have.been.calledOnce
    expect(secondSnapshot.getBinaryFileContents).to.not.have.been.called
    expect(secondResult).to.deep.equal(new Set(['sample2023']))
  })

  it('should fetch changed binary file', async function () {
    const referencer = new ReferenceIndexer()
    const initialSnapshot = snapshotWithData({
      files: {
        'refs.bib': entry1,
      },
    })
    const initialResult = await referencer.updateFromSnapshot(initialSnapshot, {
      signal: IGNORED_SIGNAL,
    })
    expect(initialSnapshot.getDocPaths).to.have.been.calledOnce
    expect(initialSnapshot.getBinaryFilePathsWithHash).to.have.been.calledOnce
    expect(initialSnapshot.getBinaryFileContents).to.have.been.calledOnceWith(
      'refs.bib'
    )
    expect(initialResult).to.deep.equal(new Set(['sample2023']))

    // Second snapshot with a different file, should fetch contents again
    const secondSnapshot = snapshotWithData({
      files: {
        'refs.bib': entry2,
      },
    })
    const secondResult = await referencer.updateFromSnapshot(secondSnapshot, {
      signal: IGNORED_SIGNAL,
    })
    expect(secondSnapshot.getDocPaths).to.have.been.calledOnce
    expect(secondSnapshot.getBinaryFilePathsWithHash).to.have.been.calledOnce
    expect(initialSnapshot.getBinaryFileContents).to.have.been.calledOnceWith(
      'refs.bib'
    )
    expect(secondResult).to.deep.equal(new Set(['example2022']))
  })

  it('should update changed doc', async function () {
    const referencer = new ReferenceIndexer()
    const initialSnapshot = snapshotWithData({
      docs: {
        'refs.bib': entry1,
      },
    })
    const initialResult = await referencer.updateFromSnapshot(initialSnapshot, {
      signal: IGNORED_SIGNAL,
    })
    expect(initialResult).to.deep.equal(new Set(['sample2023']))
    const secondSnapshot = snapshotWithData({
      docs: {
        'refs.bib': entry2,
      },
    })
    const secondResult = await referencer.updateFromSnapshot(secondSnapshot, {
      signal: IGNORED_SIGNAL,
    })
    expect(secondResult).to.deep.equal(new Set(['example2022']))
  })

  it('should notice deleted files', async function () {
    const referencer = new ReferenceIndexer()
    const initialSnapshot = snapshotWithData({
      files: {
        'refs.bib': entry1,
        'refs2.bib': entry2,
      },
    })
    const initialResult = await referencer.updateFromSnapshot(initialSnapshot, {
      signal: IGNORED_SIGNAL,
    })
    expect(initialSnapshot.getDocPaths).to.have.been.calledOnce
    expect(initialSnapshot.getBinaryFilePathsWithHash).to.have.been.calledOnce
    expect(initialSnapshot.getBinaryFileContents).to.have.been.calledTwice
    expect(initialResult).to.deep.equal(new Set(['sample2023', 'example2022']))

    // Second snapshot with one file removed, should update index
    const secondSnapshot = snapshotWithData({
      files: {
        'refs.bib': entry1,
      },
    })
    const secondResult = await referencer.updateFromSnapshot(secondSnapshot, {
      signal: IGNORED_SIGNAL,
    })
    expect(secondSnapshot.getDocPaths).to.have.been.calledOnce
    expect(secondSnapshot.getBinaryFilePathsWithHash).to.have.been.calledOnce
    expect(secondSnapshot.getBinaryFileContents).to.not.have.been.called
    expect(secondResult).to.deep.equal(new Set(['sample2023']))
  })

  it('should notice deleted docs', async function () {
    const referencer = new ReferenceIndexer()
    const initialSnapshot = snapshotWithData({
      docs: {
        'refs.bib': entry1,
        'refs2.bib': entry2,
      },
    })
    const initialResult = await referencer.updateFromSnapshot(initialSnapshot, {
      signal: IGNORED_SIGNAL,
    })
    expect(initialSnapshot.getDocPaths).to.have.been.calledOnce
    expect(initialSnapshot.getDocContents).to.have.been.calledTwice
    expect(initialResult).to.deep.equal(new Set(['sample2023', 'example2022']))

    // Second snapshot with one doc removed, should update index
    const secondSnapshot = snapshotWithData({
      docs: {
        'refs.bib': entry1,
      },
    })
    const secondResult = await referencer.updateFromSnapshot(secondSnapshot, {
      signal: IGNORED_SIGNAL,
    })
    expect(secondSnapshot.getDocPaths).to.have.been.calledOnce
    expect(secondSnapshot.getDocContents).to.have.been.calledOnce
    expect(secondResult).to.deep.equal(new Set(['sample2023']))
  })

  it('should abort when signalled', async function () {
    const referencer = new ReferenceIndexer()
    const snapshot = snapshotWithData({
      files: {
        'refs.bib': entry1,
        'refs2.bib': entry2,
      },
    })
    const controller = new AbortController()
    controller.abort()
    const result = await referencer.updateFromSnapshot(snapshot, {
      signal: controller.signal,
    })
    expect(result).to.deep.equal(new Set())
  })

  it('should respect data budget', async function () {
    async function testWithDataBudget(budget: number, keys: Set<string>) {
      const referencer = new ReferenceIndexer()
      const snapshot = snapshotWithData({
        docs: {
          'a.bib': entry1, // 140 bytes
          'b.bib': entry2, // 140 bytes
          'c.bib': entry3, // 140 bytes
          'd.bib': entry4, // 140 bytes
        },
      })
      const result = await referencer.updateFromSnapshot(snapshot, {
        signal: IGNORED_SIGNAL,
        dataLimit: budget,
      })
      expect(result).to.deep.equal(keys)
    }

    await testWithDataBudget(
      1000,
      new Set(['sample2023', 'example2022', 'sample2024', 'example2025'])
    )
    await testWithDataBudget(300, new Set(['sample2023', 'example2022']))
    await testWithDataBudget(200, new Set(['sample2023']))
    await testWithDataBudget(100, new Set())
  })
})
