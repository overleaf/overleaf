import { expect } from 'chai'

import iconTypeFromName from '../../../../../frontend/js/features/file-tree/util/icon-type-from-name'

describe('iconTypeFromName', function () {
  it('returns correct icon type', function () {
    expect(iconTypeFromName('main.tex')).to.equal('file')
    expect(iconTypeFromName('main.png')).to.equal('image')
    expect(iconTypeFromName('main.csv')).to.equal('table')
    expect(iconTypeFromName('main.py')).to.equal('file-text')
    expect(iconTypeFromName('main.bib')).to.equal('book')
  })

  it('handles missing extensions', function () {
    expect(iconTypeFromName('main')).to.equal('file')
  })

  it('lowercases extension', function () {
    expect(iconTypeFromName('ZOTERO.BIB')).to.equal('book')
  })
})
