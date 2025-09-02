import { expect } from 'chai'
import { ReferenceIndex } from '@/features/ide-react/references/reference-index'

class TestedReferenceIndex extends ReferenceIndex {
  updateIndex(): void {
    throw new Error('This is a test implementation')
  }
}
describe('ReferenceIndex', function () {
  beforeEach(function () {
    this.index = new TestedReferenceIndex()
  })

  describe('parseEntries', function () {
    it('should parse bib entry', function () {
      const content = `
@article{sample2023,
  author = {John Doe},
  title = {Sample Title},
  journal = {Sample Journal},
  year = {2023},
  date = {2023-01-01}
}
`
      const entries = this.index.parseEntries(content)
      expect(entries).to.have.lengthOf(1)
      expect(entries[0]).to.deep.equal({
        EntryKey: 'sample2023',
        EntryType: 'article',
        Fields: {
          author: 'John Doe',
          title: 'Sample Title',
          journal: 'Sample Journal',
          year: '2023',
          date: '2023-01-01',
        },
        ObjectType: 'entry',
      })
    })

    it('should default missing fields to empty strings', function () {
      const content = `@article{sample2023,
  author = {John Doe},
  title = {Sample Title}
}`
      const entries = this.index.parseEntries(content)
      expect(entries).to.have.lengthOf(1)
      expect(entries[0]).to.deep.equal({
        EntryKey: 'sample2023',
        EntryType: 'article',
        Fields: {
          author: 'John Doe',
          title: 'Sample Title',
          journal: '',
          year: '',
          date: '',
        },
        ObjectType: 'entry',
      })
    })

    it('should handle multiple entries', function () {
      const content = `@article{sample2023,
  author = {John Doe},
  title = {Sample Title},
  journal = {Sample Journal},
  year = {2023},
  date = {2023-01-01}
}
@book{example2022,
  author = {Jane Smith},
  title = {Example Book},
  journal = {Example Journal},
  year = {2022},
  date = {2022-05-15}
}`
      const entries = this.index.parseEntries(content)
      expect(entries).to.have.lengthOf(2)
      expect(entries[0].EntryKey).to.equal('sample2023')
      expect(entries[1].EntryKey).to.equal('example2022')
    })
  })
})
