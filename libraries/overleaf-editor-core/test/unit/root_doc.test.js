// @ts-check
'use strict'

const { expect } = require('chai')

const File = require('../../lib/file')
const Snapshot = require('../../lib/snapshot')
const {
  chooseRootDoc,
  isRootDocCandidate,
  setMainPathnameOperations,
} = require('../../lib/root_doc')

const WITH_CLASS = '\\documentclass{article}\n\\begin{document}\nhi\n'
const WITHOUT_CLASS = '\\section{One}\nsome text\n'

describe('root_doc', function () {
  /**
   * @param {Record<string, string>} docs
   * @return {Snapshot}
   */
  function snapshotOf(docs) {
    const snapshot = new Snapshot()
    for (const [pathname, content] of Object.entries(docs)) {
      snapshot.addFile(pathname, File.fromString(content))
    }
    return snapshot
  }

  describe('isRootDocCandidate', function () {
    it('takes a doc that declares a document class', function () {
      expect(isRootDocCandidate('paper.tex', WITH_CLASS)).to.be.true
      expect(isRootDocCandidate('paper.Rtex', WITH_CLASS)).to.be.true
    })

    it('leaves a doc that declares none', function () {
      expect(isRootDocCandidate('chapter.tex', WITHOUT_CLASS)).to.be.false
    })

    it('leaves a name a root doc cannot have', function () {
      // The content says document class, but the compiler is never given the file.
      expect(isRootDocCandidate('README.md', WITH_CLASS)).to.be.false
    })

    it('reads a declaration from the start of a line, indented or not', function () {
      expect(isRootDocCandidate('paper.tex', '  \\documentclass{article}\n')).to
        .be.true
      // Not a declaration this project has: commented out, or the argument of
      // something else. Web's rule, and what keeps the scan to a line's beginning.
      expect(isRootDocCandidate('paper.tex', '% \\documentclass{article}\n')).to
        .be.false
      expect(
        isRootDocCandidate('paper.tex', '\\input{\\documentclass{article}}\n')
      ).to.be.false
    })

    it('reads only the start of a doc', function () {
      const buried = 'x\n'.repeat(20_000) + WITH_CLASS
      expect(isRootDocCandidate('paper.tex', buried)).to.be.false
    })
  })

  describe('chooseRootDoc', function () {
    it('records the only doc that could be it', function () {
      const snapshot = snapshotOf({
        'notes.tex': WITHOUT_CLASS,
        'paper.tex': WITH_CLASS,
      })

      const chosen = chooseRootDoc(snapshot, ['paper.tex'])

      expect(chosen?.pathname).to.equal('paper.tex')
      expect(
        chosen?.operations.map(operation => operation.toRaw())
      ).to.deep.equal([{ pathname: 'paper.tex', metadata: { main: true } }])
    })

    it('prefers a doc beside the project to one below it', function () {
      // A main file that only includes the others sits at the top.
      const snapshot = snapshotOf({
        'chapters/one.tex': WITH_CLASS,
        'main.tex': WITH_CLASS,
      })

      const chosen = chooseRootDoc(snapshot, ['chapters/one.tex', 'main.tex'])

      expect(chosen?.pathname).to.equal('main.tex')
    })

    it('answers the same way whichever order it is given them in', function () {
      const snapshot = snapshotOf({
        'a/deep.tex': WITH_CLASS,
        'b/deep.tex': WITH_CLASS,
      })

      expect(
        chooseRootDoc(snapshot, ['a/deep.tex', 'b/deep.tex'])?.pathname
      ).to.equal(
        chooseRootDoc(snapshot, ['b/deep.tex', 'a/deep.tex'])?.pathname
      )
    })

    it('leaves a root doc history already records alone', function () {
      // A user's choice, which nothing here is in a position to improve on.
      const snapshot = snapshotOf({
        'chosen.tex': WITHOUT_CLASS,
        'paper.tex': WITH_CLASS,
      })
      snapshot.getFile('chosen.tex')?.setMetadata({ main: true })

      expect(chooseRootDoc(snapshot, ['paper.tex'])).to.be.null
    })

    it('answers for a project with nothing to compile', function () {
      const snapshot = snapshotOf({ 'notes.tex': WITHOUT_CLASS })

      expect(chooseRootDoc(snapshot, [])).to.be.null
    })

    it('leaves out a doc the project does not have', function () {
      // A doc whose write was skipped: recording it would leave the mark on a
      // pathname with no file behind it.
      const snapshot = snapshotOf({ 'main.tex': WITH_CLASS })

      const chosen = chooseRootDoc(snapshot, ['dropped.tex', 'main.tex'])

      expect(chosen?.pathname).to.equal('main.tex')
      expect(chooseRootDoc(snapshot, ['dropped.tex'])).to.be.null
    })
  })

  describe('setMainPathnameOperations', function () {
    it('moves the record off the file that held it', function () {
      const snapshot = snapshotOf({
        'old.tex': WITH_CLASS,
        'new.tex': WITH_CLASS,
      })
      snapshot.getFile('old.tex')?.setMetadata({ main: true })

      const operations = setMainPathnameOperations(snapshot, 'new.tex')

      expect(operations.map(operation => operation.toRaw())).to.deep.equal([
        { pathname: 'new.tex', metadata: { main: true } },
        { pathname: 'old.tex', metadata: {} },
      ])
    })

    it('has nothing to do for the file that already holds it', function () {
      const snapshot = snapshotOf({ 'main.tex': WITH_CLASS })
      snapshot.getFile('main.tex')?.setMetadata({ main: true })

      expect(setMainPathnameOperations(snapshot, 'main.tex')).to.deep.equal([])
    })

    it('keeps the other doc flags of both files', function () {
      // Metadata is replaced rather than merged, so a bibliography a file is also
      // the main one of has to be written out again with the change.
      const snapshot = snapshotOf({
        'old.tex': WITH_CLASS,
        'new.tex': WITH_CLASS,
      })
      snapshot
        .getFile('old.tex')
        ?.setMetadata({ main: true, mainBibliography: true })
      snapshot.getFile('new.tex')?.setMetadata({ mainBibliography: true })

      const operations = setMainPathnameOperations(snapshot, 'new.tex')

      expect(operations.map(operation => operation.toRaw())).to.deep.equal([
        {
          pathname: 'new.tex',
          metadata: { main: true, mainBibliography: true },
        },
        { pathname: 'old.tex', metadata: { mainBibliography: true } },
      ])
    })

    it('refuses a file carrying other metadata', function () {
      // Metadata shapes do not combine, so recording this would throw the rest away.
      const snapshot = snapshotOf({ 'linked.tex': WITH_CLASS })
      snapshot.getFile('linked.tex')?.setMetadata({
        provider: 'project_file',
        source_entity_path: '/main.tex',
        source_project_id: 'p',
      })

      expect(() => setMainPathnameOperations(snapshot, 'linked.tex')).to.throw(
        'only a doc can be the root doc'
      )
    })
  })
})
