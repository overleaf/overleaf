const { expect } = require('chai')
const { walkRootFolder } = require('../lib/syncer')

describe('walkRootFolder', () => {
  it('flattens a single-level project', () => {
    const entries = walkRootFolder([
      {
        _id: 'root',
        name: '',
        docs: [
          { _id: 'doc1', name: 'main.tex' },
          { _id: 'doc2', name: 'refs.bib' },
        ],
        folders: [],
      },
    ])
    expect(entries).to.deep.equal([
      { docId: 'doc1', pathname: 'main.tex' },
      { docId: 'doc2', pathname: 'refs.bib' },
    ])
  })

  it('walks nested folders and joins pathnames', () => {
    const entries = walkRootFolder([
      {
        _id: 'root',
        name: '',
        docs: [{ _id: 'd1', name: 'main.tex' }],
        folders: [
          {
            _id: 'chapters',
            name: 'chapters',
            docs: [{ _id: 'd2', name: 'intro.tex' }],
            folders: [
              {
                _id: 'sub',
                name: 'sub',
                docs: [{ _id: 'd3', name: 'deep.tex' }],
                folders: [],
              },
            ],
          },
        ],
      },
    ])
    expect(entries).to.deep.equal([
      { docId: 'd1', pathname: 'main.tex' },
      { docId: 'd2', pathname: 'chapters/intro.tex' },
      { docId: 'd3', pathname: 'chapters/sub/deep.tex' },
    ])
  })

  it('handles empty rootFolder', () => {
    expect(walkRootFolder([])).to.deep.equal([])
  })

  it('coerces ObjectId-like _id to string', () => {
    const entries = walkRootFolder([
      {
        docs: [{ _id: { toString: () => 'abc123' }, name: 'f.tex' }],
        folders: [],
      },
    ])
    expect(entries[0].docId).to.equal('abc123')
  })
})
