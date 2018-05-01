import CodeMirror from 'codemirror'

import fixture from './support/fixture'

const TEXTAREA_HTML = '<textarea>Test</textarea>'

describe('fixtures', function () {
  beforeEach(function () {
    this.textarea = fixture.load(TEXTAREA_HTML)
    this.cm = CodeMirror.fromTextArea(this.textarea)
  })

  afterEach(() => {
    fixture.cleanUp()
  })

  it('loads fixtures', function () {
    expect(this.textarea.value).to.equal('Test')
  })

  it('works with CM', function () {
    expect(this.cm.getValue()).to.equal('Test')
  })
})
