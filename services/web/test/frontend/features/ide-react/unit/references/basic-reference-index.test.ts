import BasicReferenceIndex from '@/features/ide-react/references/basic-reference-index'
import { expect } from 'chai'

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

const entry3 = `@inproceedings{test2021,
  author = {Alice Johnson},
  title = {Test Conference Paper},
  booktitle = {Test Conference},
  year = {2021},
  date = {2021-10-10}
}
`

const fileWithMultipleEntries = `${entry1}\n${entry2}`

const addEntry1 = { path: 'file1.bib', content: entry1 }
const addEntry2 = { path: 'file2.bib', content: entry2 }
const addEntry3 = { path: 'file3.bib', content: entry3 }
const addFileWithMultipleEntries = {
  path: 'file5.bib',
  content: fileWithMultipleEntries,
}
const deleteEntry2 = 'file2.bib'

describe('BasicReferenceIndex', function () {
  beforeEach(function () {
    this.index = new BasicReferenceIndex()
  })

  it('starts with an empty index', function () {
    expect(this.index.fileIndex.size).to.equal(0)
    expect(this.index.keys.size).to.equal(0)
  })

  describe('updateIndex', function () {
    it('Adds entry to index and keys', function () {
      const changes = { updates: [addEntry1], deletes: [] }
      const keys = this.index.updateIndex(changes)
      expect(this.index.fileIndex.size).to.equal(1)
      expect(this.index.fileIndex.get('file1.bib')).to.deep.equal(
        new Set(['sample2023'])
      )
      expect(keys).to.deep.equal(new Set(['sample2023']))
    })

    it("doesn't forget existing keys when adding new entries", function () {
      const changes = { updates: [addEntry1, addEntry2], deletes: [] }
      const keys = this.index.updateIndex(changes)
      expect(this.index.fileIndex.size).to.equal(2)
      expect(keys).to.deep.equal(new Set(['sample2023', 'example2022']))

      const additionalChanges = { updates: [addEntry3], deletes: [] }
      const updatedKeys = this.index.updateIndex(additionalChanges)
      expect(this.index.fileIndex.size).to.equal(3)
      expect(updatedKeys).to.deep.equal(
        new Set(['sample2023', 'example2022', 'test2021'])
      )
    })

    it('removes keys when files are deleted', function () {
      const changes = {
        updates: [addEntry1, addEntry2, addEntry3],
        deletes: [],
      }
      this.index.updateIndex(changes)
      expect(this.index.fileIndex.size).to.equal(3)
      expect(this.index.keys).to.deep.equal(
        new Set(['sample2023', 'example2022', 'test2021'])
      )

      const deletionChanges = { updates: [], deletes: [deleteEntry2] }
      const keysAfterDeletion = this.index.updateIndex(deletionChanges)
      expect(this.index.fileIndex.size).to.equal(2)
      expect(keysAfterDeletion).to.deep.equal(
        new Set(['sample2023', 'test2021'])
      )
    })

    it('handles multiple entries in a single file', function () {
      const changes = { updates: [addFileWithMultipleEntries], deletes: [] }
      const keys = this.index.updateIndex(changes)
      expect(this.index.fileIndex.size).to.equal(1)
      expect(this.index.fileIndex.get('file5.bib')).to.deep.equal(
        new Set(['sample2023', 'example2022'])
      )
      expect(keys).to.deep.equal(new Set(['sample2023', 'example2022']))
    })
  })
})
