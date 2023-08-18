import { expect, use } from 'chai'
import { toggleRanges } from '../../../../../frontend/js/features/source-editor/commands/ranges'
import { CodemirrorTestSession, viewHelpers } from '../helpers/codemirror'

use(viewHelpers)

const BOLD_COMMAND = toggleRanges('\\textbf')

describe('toggleRanges', function () {
  describe('when text outside of a command is selected', function () {
    it('wraps the selection in a command', function () {
      const cm = new CodemirrorTestSession(['this <is my> range'])
      cm.applyCommand(BOLD_COMMAND)
      expect(cm).line(1).to.equal('this \\textbf{<is my>} range')
    })

    describe('when it is an empty selection', function () {
      it('inserts a wrapping command and keep cursor inside the argument', function () {
        const cm = new CodemirrorTestSession(['this is | my range'])
        cm.applyCommand(BOLD_COMMAND)
        expect(cm).line(1).to.equal('this is \\textbf{|} my range')
      })
    })

    describe('when it is an empty selection before a command', function () {
      it('inserts a wrapping command and keep cursor inside the argument', function () {
        const cm = new CodemirrorTestSession(['this is |\\textbf{my range}'])
        cm.applyCommand(BOLD_COMMAND)
        expect(cm).line(1).to.equal('this is \\textbf{|}\\textbf{my range}')
      })
    })
  })

  describe('when text inside a command is selected', function () {
    describe('if the whole command is selected', function () {
      it('removes the wrapping command', function () {
        const cm = new CodemirrorTestSession(['this \\textbf{<is my>} range'])
        cm.applyCommand(BOLD_COMMAND)
        expect(cm).line(1).to.equal('this <is my> range')
      })
    })

    describe('if the command is empty', function () {
      it('removes the command', function () {
        const cm = new CodemirrorTestSession(['\\textbf{|}'])
        cm.applyCommand(BOLD_COMMAND)
        expect(cm).line(1).to.equal('|')
      })
    })

    describe('if the selection is at the beginning of a wrapping command', function () {
      it('shifts the start of the command', function () {
        const cm = new CodemirrorTestSession(['\\textbf{<this is> my} range'])
        cm.applyCommand(BOLD_COMMAND)
        expect(cm).line(1).to.equal('this is\\textbf{ my} range')
      })
    })

    describe('if the selection is at the end of a wrapping command', function () {
      it('shifts the end of the command', function () {
        const cm = new CodemirrorTestSession(['\\textbf{this <is my>} range'])
        cm.applyCommand(BOLD_COMMAND)
        expect(cm).line(1).to.equal('\\textbf{this }<is my> range')
      })
    })

    describe('if the selection is in the middle of a wrapping command', function () {
      it('splits command in two with non-empty selection', function () {
        const cm = new CodemirrorTestSession(['\\textbf{this <is my> range}'])
        cm.applyCommand(BOLD_COMMAND)
        expect(cm).line(1).to.equal('\\textbf{this }<is my>\\textbf{ range}')
      })

      it('splits command in two with empty selection', function () {
        const cm = new CodemirrorTestSession(['\\textbf{this is | my range}'])
        cm.applyCommand(BOLD_COMMAND)
        expect(cm).line(1).to.equal('\\textbf{this is }|\\textbf{ my range}')
      })
    })
  })

  describe('when selection spans between two wrapping commands', function () {
    it('joins the two commands into one', function () {
      const cm = new CodemirrorTestSession([
        '\\textbf{this <is} my \\textbf{ran>ge}',
      ])
      cm.applyCommand(BOLD_COMMAND)
      expect(cm).line(1).to.equal('\\textbf{this <is my ran>ge}')
    })
  })

  describe('when selection spans across a wrapping command', function () {
    it('extends to the left', function () {
      const cm = new CodemirrorTestSession(['<this \\textbf{is my> range}'])
      cm.applyCommand(BOLD_COMMAND)
      expect(cm).line(1).to.equal('\\textbf{<this is my> range}')
    })

    it('extends to the right', function () {
      const cm = new CodemirrorTestSession(['\\textbf{this is <my} range>'])
      cm.applyCommand(BOLD_COMMAND)
      expect(cm).line(1).to.equal('\\textbf{this is <my range>}')
    })
  })

  describe('when selection includes more than content', function () {
    describe('when selection contains command', function () {
      it('still unbolds', function () {
        const cm = new CodemirrorTestSession(['<\\textbf{this is my range>}'])
        cm.applyCommand(BOLD_COMMAND)
        expect(cm).line(1).to.equal('<this is my range>')
      })
    })

    describe('when selection contains opening bracket', function () {
      it('still unbolds', function () {
        const cm = new CodemirrorTestSession(['\\textbf<{this is my range>}'])
        cm.applyCommand(BOLD_COMMAND)
        expect(cm).line(1).to.equal('<this is my range>')
      })
    })

    describe('when selection contains closing bracket', function () {
      it('still unbolds', function () {
        const cm = new CodemirrorTestSession(['\\textbf{<this is my range}>'])
        cm.applyCommand(BOLD_COMMAND)
        expect(cm).line(1).to.equal('<this is my range>')
      })
    })

    describe('when selection contains both brackets', function () {
      it('still unbolds', function () {
        const cm = new CodemirrorTestSession(['\\textbf<{this is my range}>'])
        cm.applyCommand(BOLD_COMMAND)
        expect(cm).line(1).to.equal('<this is my range>')
      })
    })

    describe('when selection contains entire command', function () {
      it('still unbolds', function () {
        const cm = new CodemirrorTestSession(['<\\textbf{this is my range}>'])
        cm.applyCommand(BOLD_COMMAND)
        expect(cm).line(1).to.equal('<this is my range>')
      })
    })

    describe('when toggling outer command', function () {
      it('it functions on the outer command', function () {
        const cm = new CodemirrorTestSession([
          '\\textbf{\\textit{<this is my range>}}',
        ])
        cm.applyCommand(BOLD_COMMAND)
        expect(cm).line(1).to.equal('<\\textit{this is my range}>')
      })

      it('prevents breaking commands', function () {
        const cm = new CodemirrorTestSession([
          '\\textbf{\\textit{this <is} my} range>',
        ])
        cm.applyCommand(BOLD_COMMAND)
        expect(cm).line(1).to.equal('\\textbf{\\textit{this <is} my} range>')
      })
    })

    describe('when range is after a command', function () {
      it('still formats list items', function () {
        const cm = new CodemirrorTestSession([
          '\\begin{itemize}',
          '    \\item <My item>',
          '\\end{itemize}',
        ])
        cm.applyCommand(BOLD_COMMAND)
        expect(cm).line(2).to.equal('    \\item \\textbf{<My item>}')
      })

      it('still formats after command', function () {
        const cm = new CodemirrorTestSession(['\\noindent <My paragraph>'])
        cm.applyCommand(BOLD_COMMAND)
        expect(cm).line(1).to.equal('\\noindent \\textbf{<My paragraph>}')
      })

      it('still formats after unknown command with arguments', function () {
        const cm = new CodemirrorTestSession(['\\foo{test}<My paragraph>'])
        cm.applyCommand(BOLD_COMMAND)
        expect(cm).line(1).to.equal('\\foo{test}\\textbf{<My paragraph>}')
      })

      it('still formats after known command with arguments', function () {
        const cm1 = new CodemirrorTestSession(['\\cite{foo}<text>'])
        cm1.applyCommand(BOLD_COMMAND)
        expect(cm1).line(1).to.equal('\\cite{foo}\\textbf{<text>}')

        const cm2 = new CodemirrorTestSession(['\\href{url}{title}<text>'])
        cm2.applyCommand(BOLD_COMMAND)
        expect(cm2).line(1).to.equal('\\href{url}{title}\\textbf{<text>}')
      })
    })
  })

  it('still formats text next to a command', function () {
    const cm = new CodemirrorTestSession(['<item>\\foo'])
    cm.applyCommand(BOLD_COMMAND)
    expect(cm).line(1).to.equal('\\textbf{item}\\foo')
  })

  it('still formats part of a text next to command', function () {
    const cm = new CodemirrorTestSession(['hello <world>\\foo'])
    cm.applyCommand(BOLD_COMMAND)
    expect(cm).line(1).to.equal('hello \\textbf{world}\\foo')
  })

  it('still formats command without arguments', function () {
    const cm = new CodemirrorTestSession(['\\item<\\foo>'])
    cm.applyCommand(BOLD_COMMAND)
    expect(cm).line(1).to.equal('\\item\\textbf{<\\foo>}')
  })

  it('skips formatting if in the middle of two commands', function () {
    const cm = new CodemirrorTestSession(['\\f<oo\\b>ar'])
    cm.applyCommand(BOLD_COMMAND)
    expect(cm).line(1).to.equal('\\foo\\bar')
  })
})
