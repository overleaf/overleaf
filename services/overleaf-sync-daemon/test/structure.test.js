const { expect } = require('chai')
const { StructureIndex } = require('../lib/structure')

describe('StructureIndex', () => {
  function sampleProject() {
    return [
      {
        _id: 'root',
        name: '',
        docs: [
          { _id: 'd1', name: 'main.tex' },
          { _id: 'd2', name: 'refs.bib' },
        ],
        fileRefs: [{ _id: 'f1', name: 'logo.png' }],
        folders: [
          {
            _id: 'fol1',
            name: 'chapters',
            docs: [{ _id: 'd3', name: 'intro.tex' }],
            fileRefs: [],
            folders: [
              {
                _id: 'fol2',
                name: 'sub',
                docs: [{ _id: 'd4', name: 'deep.tex' }],
                fileRefs: [],
                folders: [],
              },
            ],
          },
        ],
      },
    ]
  }

  it('loads a full project tree', () => {
    const i = new StructureIndex()
    i.loadFromRootFolder(sampleProject())
    expect(i.lookupPath('main.tex')).to.deep.equal({ type: 'doc', id: 'd1' })
    expect(i.lookupPath('logo.png')).to.deep.equal({ type: 'file', id: 'f1' })
    expect(i.lookupPath('chapters')).to.deep.equal({
      type: 'folder',
      id: 'fol1',
    })
    expect(i.lookupPath('chapters/sub/deep.tex')).to.deep.equal({
      type: 'doc',
      id: 'd4',
    })
    expect(i.lookupId('d4').pathname).to.equal('chapters/sub/deep.tex')
    expect(i.rootFolderId).to.equal('root')
  })

  it('finds the parent folder of a path', () => {
    const i = new StructureIndex()
    i.loadFromRootFolder(sampleProject())
    expect(i.parentFolderIdOf('main.tex')).to.equal('root')
    expect(i.parentFolderIdOf('chapters/intro.tex')).to.equal('fol1')
    expect(i.parentFolderIdOf('chapters/sub/deep.tex')).to.equal('fol2')
  })

  it('removes a folder and all descendants', () => {
    const i = new StructureIndex()
    i.loadFromRootFolder(sampleProject())
    i.removeByPath('chapters')
    expect(i.lookupPath('chapters')).to.equal(null)
    expect(i.lookupPath('chapters/intro.tex')).to.equal(null)
    expect(i.lookupPath('chapters/sub/deep.tex')).to.equal(null)
    expect(i.lookupId('d3')).to.equal(null)
    expect(i.lookupId('d4')).to.equal(null)
    // siblings untouched
    expect(i.lookupPath('main.tex')).to.deep.equal({ type: 'doc', id: 'd1' })
  })

  it('add + lookup symmetry', () => {
    const i = new StructureIndex()
    i.setRoot('r')
    i.add('newfile.tex', 'doc', 'newdoc')
    expect(i.lookupPath('newfile.tex')).to.deep.equal({
      type: 'doc',
      id: 'newdoc',
    })
    expect(i.lookupId('newdoc').pathname).to.equal('newfile.tex')
    expect(i.parentFolderIdOf('newfile.tex')).to.equal('r')
  })

  it('removeById', () => {
    const i = new StructureIndex()
    i.loadFromRootFolder(sampleProject())
    i.removeById('d1')
    expect(i.lookupPath('main.tex')).to.equal(null)
    expect(i.lookupId('d1')).to.equal(null)
  })
})
