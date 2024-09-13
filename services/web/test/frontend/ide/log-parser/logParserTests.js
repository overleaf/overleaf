import { expect } from 'chai'
import LatexLogParser from '../../../../frontend/js/ide/log-parser/latex-log-parser'
import BibLogParser from '../../../../frontend/js/ide/log-parser/bib-log-parser'

const fixturePath = '../../helpers/fixtures/logs/'
const fs = require('fs')
const path = require('path')

describe('logParser', function () {
  it('should parse errors', function () {
    const { errors } = parseLatexLog('errors.log', { ignoreDuplicates: true })
    expect(errors.map(e => [e.line, e.message])).to.deep.equal([
      [29, 'Undefined control sequence.'],
      [
        30,
        'LaTeX Error: \\begin{equation} on input line 28 ended by \\end{equaion}.',
      ],
      [30, 'Missing $ inserted.'],
      [30, 'Display math should end with $$.'],
      [46, 'Extra }, or forgotten \\right.'],
      [46, 'Missing \\right. inserted.'],
      [46, 'Missing } inserted.'],
    ])
  })

  it('should parse Badbox errors', function () {
    const { typesetting } = parseLatexLog('bad-boxes.log')
    expect(typesetting.map(e => [e.line, e.message])).to.deep.equal([
      [9, 'Overfull \\hbox (29.11179pt too wide) in paragraph at lines 9--10'],
      [11, 'Underfull \\hbox (badness 10000) in paragraph at lines 11--13'],
      [27, 'Overfull \\vbox (12.00034pt too high) detected at line 27'],
      [46, 'Underfull \\vbox (badness 10000) detected at line 46'],
      [54, 'Underfull \\hbox (badness 10000) in paragraph at lines 54--55'],
      [58, 'Underfull \\hbox (badness 10000) in paragraph at lines 58--60'],
    ])
  })

  it('should parse Warnings', function () {
    const { warnings } = parseLatexLog('warnings.log')
    expect(warnings.map(e => [e.line, e.message, e.file])).to.deep.equal([
      [
        7,
        "Citation `Lambert:2010iw' on page 1 undefined on input line 7.",
        'compiles/d1585ce575dea4cab55f784a22a88652/sections/introduction.tex',
      ],
      [
        7,
        "Citation `Lambert:2010iw' on page 1 undefined on input line 7.",
        'compiles/d1585ce575dea4cab55f784a22a88652/sections/introduction.tex',
      ],
      [
        72,
        "Citation `Manton:2004tk' on page 3 undefined on input line 72.",
        'compiles/d1585ce575dea4cab55f784a22a88652/sections/instantons.tex',
      ],
      [
        108,
        "Citation `Atiyah1978' on page 4 undefined on input line 108.",
        'compiles/d1585ce575dea4cab55f784a22a88652/sections/instantons.tex',
      ],
      [
        176,
        "Citation `Dorey:1996hu' on page 5 undefined on input line 176.",
        'compiles/d1585ce575dea4cab55f784a22a88652/sections/instantons.tex',
      ],
      [
        3,
        "Citation `Manton1982' on page 8 undefined on input line 3.",
        'compiles/d1585ce575dea4cab55f784a22a88652/sections/moduli_space_approximation.tex',
      ],
      [
        21,
        "Citation `Weinberg:2006rq' on page 9 undefined on input line 21.",
        'compiles/d1585ce575dea4cab55f784a22a88652/sections/moduli_space_approximation.tex',
      ],
      [
        192,
        "Citation `Bak:1999sv' on page 12 undefined on input line 192.",
        'compiles/d1585ce575dea4cab55f784a22a88652/sections/moduli_space_approximation.tex',
      ],
      [
        9,
        "Citation `Peeters:2001np' on page 13 undefined on input line 9.",
        'compiles/d1585ce575dea4cab55f784a22a88652/sections/dynamics_of_single_instanton.tex',
      ],
      [
        27,
        "Citation `Osborn:1981yf' on page 15 undefined on input line 27.",
        'compiles/d1585ce575dea4cab55f784a22a88652/sections/dynamics_of_two_instantons.tex',
      ],
      [
        27,
        "Citation `Peeters:2001np' on page 15 undefined on input line 27.",
        'compiles/d1585ce575dea4cab55f784a22a88652/sections/dynamics_of_two_instantons.tex',
      ],
      [
        20,
        "Citation `Osborn:1981yf' on page 22 undefined on input line 20.",
        'compiles/d1585ce575dea4cab55f784a22a88652/sections/appendices.tex',
      ],
      [
        103,
        "Citation `Osborn:1981yf' on page 23 undefined on input line 103.",
        'compiles/d1585ce575dea4cab55f784a22a88652/sections/appendices.tex',
      ],
      [
        103,
        "Citation `Peeters:2001np' on page 23 undefined on input line 103.",
        'compiles/d1585ce575dea4cab55f784a22a88652/sections/appendices.tex',
      ],
      [
        352,
        "Citation `Peeters:2001np' on page 27 undefined on input line 352.",
        'compiles/d1585ce575dea4cab55f784a22a88652/sections/appendices.tex',
      ],
      // the logs display an additional summary error for undefined references
      [
        null,
        'There were undefined references.',
        'compiles/d1585ce575dea4cab55f784a22a88652/instantons.tex',
      ],
    ])
  })

  it('should parse Biber warnings', function () {
    const { warnings } = parseLatexLog('biber-warnings.log')
    expect(warnings.map(w => [w.line, w.message, w.file])).to.deep.equal([
      [
        null,
        'Package biblatex Warning: No "backend" specified, using Biber backend. To use BibTeX, load biblatex with the "backend=bibtex" option.',
        '/usr/local/texlive/2013/texmf-dist/tex/latex/biblatex/biblatex.sty',
      ],
      [
        null,
        'Package biblatex Warning: The following entry could not be found in the database: Missing3 Please verify the spelling and rerun LaTeX afterwards.',
        '/compile/output.bbl',
      ],
      [
        null,
        'Package biblatex Warning: The following entry could not be found in the database: Missing2 Please verify the spelling and rerun LaTeX afterwards.',
        '/compile/output.bbl',
      ],
      [
        null,
        'Package biblatex Warning: The following entry could not be found in the database: Missing1 Please verify the spelling and rerun LaTeX afterwards.',
        '/compile/output.bbl',
      ],
    ])
  })

  it('should parse Natbib warnings', function () {
    const { warnings } = parseLatexLog('natbib-warnings.log')
    expect(warnings.map(w => [w.line, w.message, w.file])).to.deep.equal([
      [
        6,
        "Package natbib Warning: Citation `blah' on page 1 undefined on input line 6.",
        '/compile/main.tex',
      ],
      [
        null,
        'Package natbib Warning: There were undefined citations.',
        '/compile/main.tex',
      ],
    ])
  })

  it('should parse Geometry warnings', function () {
    const { warnings } = parseLatexLog('geometry-warnings.log')
    expect(warnings.map(w => [w.line, w.message, w.file])).to.deep.equal([
      [
        null,
        "Package geometry Warning: Over-specification in `h'-direction. `width' (597.50787pt) is ignored.",
        '/compile/main.tex',
      ],
      [
        null,
        "Package geometry Warning: Over-specification in `v'-direction. `height' (845.04684pt) is ignored.",
        '/compile/main.tex',
      ],
    ])
  })

  it('should parse Caption warnings', function () {
    const { warnings } = parseLatexLog('caption-warnings.log')
    expect(warnings.map(w => [w.line, w.message, w.file])).to.deep.equal([
      [
        null,
        'Package caption Warning: Unsupported document class (or package) detected, usage of the caption package is not recommended. See the caption package documentation for explanation.',
        '/usr/local/texlive/2014/texmf-dist/tex/latex/caption/caption.sty',
      ],
      [
        46,
        "Package caption Warning: The option `hypcap=true' will be ignored for this particular \\caption on input line 46. See the caption package documentation for explanation.",
        '/compile/main.tex',
      ],
    ])
  })

  it('should parse Runaway Arguments', function () {
    const { errors } = parseLatexLog('runaway-arguments.log')
    expect(errors.map(e => [e.line, e.message, e.file])).to.deep.equal([
      [null, 'Runaway argument?', '/compile/runaway_argument.tex'],
      [null, 'Emergency stop.', '/compile/runaway_argument.tex'],
    ])
  })

  it('should parse filenames', function () {
    const { errors, warnings, typesetting } = parseLatexLog('filenames.log')

    expect(errors.map(e => [e.line, e.message, e.file])).to.deep.equal([
      [
        1,
        'Undefined control sequence.',
        '/compile/a folder with spaces/a subfolder with spaces/a subsubfolder with spaces/another file with spaces.tex',
      ],
    ])
    expect(warnings.map(w => [w.line, w.message, w.file])).to.deep.equal([
      [
        9,
        "Citation `Peeters:2001np' on page 13 undefined on input line 9.",
        '/compile/main',
      ],
    ])
    expect(typesetting.map(e => [e.line, e.message, e.file])).to.deep.equal([
      [
        123,
        'Overfull \\hbox (4.56pt too wide) in paragraph at lines 123--456',
        '/compile/otherfile',
      ],
    ])
  })

  it('should perform file line error parsing', function () {
    const { errors } = parseLatexLog('file-line-error.log')
    expect(errors.map(e => [e.line, e.message, e.file])).to.deep.equal([
      [
        '1',
        'Undefined control sequence.',
        '/compile/a folder with spaces/a subfolder with spaces/a subsubfolder with spaces/another file with spaces.tex',
      ],
    ])
  })

  it('should perform more complex file line error parsing', function () {
    const { errors } = parseLatexLog('file-line-error-2.log')
    expect(errors.map(e => [e.line, e.message, e.file])).to.deep.equal([
      [1, 'Misplaced alignment tab character &.', './acks/name.tex'],
      [14, 'Misplaced alignment tab character &.', './main.tex'],
    ])
  })

  it('should ignore duplicates', function () {
    // duplicates included
    const { errors } = parseLatexLog('errors.log')
    expect(errors.length).to.equal(10)

    // duplicates excluded
    const { errors: errorsDeduplicated } = parseLatexLog('errors.log', {
      ignoreDuplicates: true,
    })
    expect(errorsDeduplicated.length).to.equal(7)
  })

  it('should get file paths', function () {
    const { errors } = parseLatexLog('errors.log')

    for (const error of errors) {
      expect(error.file).to.equal(
        'compiles/dff0c37d892f346e58fc14975a16bf69/sections/appendices.tex'
      )
    }

    const { all: badBoxesErrors } = parseLatexLog('bad-boxes.log')
    for (const error of badBoxesErrors) {
      expect(error.file).to.equal(
        'compiles/b6cf470376785e64ad84c57e3296c912/logs/bad-boxes.tex'
      )
    }
  })

  it('should parse a typical biber .blg file', function () {
    const log = readLog('biber.blg')
    const bibParser = new BibLogParser(log, {})
    const result = bibParser.parse()
    expect(typeof result).to.equal('object')
    expect(result.all.length).to.equal(14)
    expect(result.errors.length).to.equal(1)
    expect(result.warnings.length).to.equal(2)

    const error = result.errors[0]
    expect(error.level).to.equal('error')
    expect(error.line).to.equal('8')
    expect(error.file).to.equal('bibliography.bib')
    expect(error.message).to.equal(
      'syntax error: at end of input, expected end of entry ("}" or ")") (skipping to next "@")'
    )
  })

  it('should throw an error when non-biblog passed to BibLogParser', function () {
    const log = readLog('caption-warnings.log')
    const bibParser = new BibLogParser(log, {})
    expect(() => bibParser.parse()).to.throw()
  })

  it('should throw an error when empty string passed to BibLogParser', function () {
    const bibParser = new BibLogParser('', {})
    expect(() => bibParser.parse()).to.throw()
  })

  it('should throw an error when non-string passed to BibLogParser', function () {
    expect(() => new BibLogParser({ a: 1 }, {})).to.throw()
  })

  it('should parse a typical bibtex .blg file', function () {
    const log = readLog('bibtex.blg')
    const bibParser = new BibLogParser(log, {})
    const result = bibParser.parse()

    expect(typeof result).to.equal('object')
    expect(result.all.length).to.equal(13)

    expect(result.warnings.length).to.equal(6)
    const firstWarning = result.warnings[0]
    expect(firstWarning.file).to.equal('references.bib')
    expect(firstWarning.line).to.equal('152')
    expect(firstWarning.level).to.equal('warning')
    expect(firstWarning.message).to.equal(
      'string name "something" is undefined'
    )

    const thirdWarning = result.warnings[2]
    expect(thirdWarning.message).to.equal(
      "can't use both author and editor fields in Binney87"
    )

    expect(result.errors.length).to.equal(7)
    const firstError = result.errors[0]
    expect(firstError.file).to.equal('references.bib')
    expect(firstError.line).to.equal('196')
    expect(firstError.level).to.equal('error')
    expect(
      firstError.message.indexOf("I was expecting a `,' or a `}'")
    ).to.equal(0)
    expect(
      firstError.message.indexOf('(Error may have been on previous line)') > 0
    ).to.equal(true)
    const crossReferenceError = result.errors[5]
    expect(crossReferenceError.level).to.equal('error')
    expect(
      crossReferenceError.message.indexOf('A bad cross reference')
    ).to.equal(0)
    const styleError = result.errors[6]
    expect(styleError.level).to.equal('error')
    expect(
      styleError.message.indexOf("I couldn't open style file aa.bst")
    ).to.equal(0)
  })

  // https://github.com/overleaf/overleaf/issues/1023
  it('should parse logs from issue 1023', function () {
    const { errors, warnings } = parseLatexLog('open-source-issue-1023.log')
    expect(errors.map(x => [x.line, x.message, x.file])).to.deep.equal([
      [38, 'Package PACKAGE Error: TEXT PackageError.', './main.tex'],
      [45, 'Class PACKAGE Error: TEXT ClassError.', './main.tex'],
      [53, 'LaTeX Error: TEXT @latex@error.', './main.tex'],
      [72, 'Package PACKAGE Error: TEXT msg_error package', './main.tex'],
      [84, 'Class PACKAGE Error: TEXT msg_error class', './main.tex'],
      [97, 'LaTeX3 Error: TEXT msg_error latex3', './main.tex'],
      [
        6,
        'Critical LaTeX3 Error: TEXT msg_critical latex3',
        './output-critical.tex',
      ],
      [
        133,
        'Missing character: There is no 3 ("33) in font nullfont.',
        './main.tex',
      ],
    ])
    expect(warnings.map(x => [x.line, x.message, x.file])).to.deep.equal([
      [
        37,
        'Package PACKAGE Warning: TEXT PackageWarning on input line 37.',
        './main.tex',
      ],
      [
        44,
        'Class PACKAGE Warning: TEXT ClassWarning on input line 44.',
        './main.tex',
      ],
      [52, 'TEXT @latex@warning on input line 52.', './main.tex'],
      [58, 'TEXT @font@warning on input line 58.', './main.tex'],
      [null, 'Package PACKAGE Warning: TEXT msg_warning package', './main.tex'],
      [null, 'Class PACKAGE Warning: TEXT msg_warning class', './main.tex'],
      [null, 'TEXT msg_warning latex3', './main.tex'],
      [
        null,
        "File `output-critical' already exists on the system.",
        './main.tex',
      ],
    ])
  })

  it('should parse errors without blank lines between them', function () {
    const { errors, warnings } = parseLatexLog('undefined-control-sequence.log')
    expect(warnings).to.be.empty
    expect(errors.map(x => [x.line, x.message, x.file])).to.deep.equal([
      [3, 'Undefined control sequence.', './main.tex'],
      [4, 'Undefined control sequence.', './main.tex'],
      [5, 'Undefined control sequence.', './main.tex'],
      [5, 'LaTeX Error: Illegal character in array arg.', './main.tex'],
      [5, 'LaTeX Error: Illegal character in array arg.', './main.tex'],
      [6, 'Undefined control sequence.', './main.tex'],
      [7, 'Undefined control sequence.', './main.tex'],
      [8, 'Undefined control sequence.', './main.tex'],
      [8, 'LaTeX Error: Illegal character in array arg.', './main.tex'],
      [8, 'LaTeX Error: Illegal character in array arg.', './main.tex'],
    ])
  })

  it('should not unwrap errors into previous line', function () {
    const { errors, warnings } = parseLatexLog(
      'lncs-undefined-control-sequence.log'
    )
    expect(warnings).to.be.empty
    expect(errors.map(x => [x.line, x.message, x.file])).to.deep.equal([
      [102, 'Undefined control sequence.', './main.tex'],
    ])
  })
})

function readLog(filename) {
  return fs.readFileSync(path.resolve(__dirname, fixturePath + filename), {
    encoding: 'utf8',
    flag: 'r',
  })
}

function parseLatexLog(filename, opts = {}) {
  const log = readLog(filename)
  const parser = new LatexLogParser(log, opts)
  return parser.parse()
}
