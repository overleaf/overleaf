import { expect } from 'chai'

import iconTypeFromName from '../../../../../frontend/js/features/file-tree/util/icon-type-from-name'

describe('iconTypeFromName', function () {
  it('returns correct icon type', function () {
    expect(iconTypeFromName('main.tex')).to.equal('description')
    expect(iconTypeFromName('main.png')).to.equal('image')
    expect(iconTypeFromName('main.csv')).to.equal('table_chart')
    expect(iconTypeFromName('main.py')).to.equal('code')
    expect(iconTypeFromName('main.bib')).to.equal('menu_book')
  })

  it('handles missing extensions', function () {
    expect(iconTypeFromName('main')).to.equal('description')
  })

  it('lowercases extension', function () {
    expect(iconTypeFromName('ZOTERO.BIB')).to.equal('menu_book')
  })
})
