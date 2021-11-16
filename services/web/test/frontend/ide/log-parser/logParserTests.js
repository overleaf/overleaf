import { expect } from 'chai'
import LatexLogParser from '../../../../frontend/js/ide/log-parser/latex-log-parser'
import BibLogParser from '../../../../frontend/js/ide/log-parser/bib-log-parser'

const fixturePath = '../../helpers/fixtures/logs/'
const fs = require('fs')
const path = require('path')

describe('logParser', function (done) {
  before(function () {
    this.errorLog = fs.readFileSync(
      path.resolve(__dirname, fixturePath + 'errors.log'),
      {
        encoding: 'utf8',
        flag: 'r',
      }
    )
    this.warningLog = fs.readFileSync(
      path.resolve(__dirname, fixturePath + 'warnings.log'),
      {
        encoding: 'utf8',
        flag: 'r',
      }
    )
    this.badBoxesLog = fs.readFileSync(
      path.resolve(__dirname, fixturePath + 'bad-boxes.log'),
      {
        encoding: 'utf8',
        flag: 'r',
      }
    )
    this.biberWarningsLog = fs.readFileSync(
      path.resolve(__dirname, fixturePath + 'biber-warnings.log'),
      { encoding: 'utf8', flag: 'r' }
    )
    this.natbibWarningsLog = fs.readFileSync(
      path.resolve(__dirname, fixturePath + 'natbib-warnings.log'),
      { encoding: 'utf8', flag: 'r' }
    )
    this.geometryWarningsLog = fs.readFileSync(
      path.resolve(__dirname, fixturePath + 'geometry-warnings.log'),
      { encoding: 'utf8', flag: 'r' }
    )
    this.captionWarningsLog = fs.readFileSync(
      path.resolve(__dirname, fixturePath + 'caption-warnings.log'),
      { encoding: 'utf8', flag: 'r' }
    )
    this.runawayArgumentsLog = fs.readFileSync(
      path.resolve(__dirname, fixturePath + 'runaway-arguments.log'),
      { encoding: 'utf8', flag: 'r' }
    )
    this.biberBlg = fs.readFileSync(
      path.resolve(__dirname, fixturePath + 'biber.blg'),
      {
        encoding: 'utf8',
        flag: 'r',
      }
    )
    this.bibtexBlg = fs.readFileSync(
      path.resolve(__dirname, fixturePath + 'bibtex.blg'),
      {
        encoding: 'utf8',
        flag: 'r',
      }
    )
    this.fileLineErrorLog = fs.readFileSync(
      path.resolve(__dirname, fixturePath + 'file-line-error.log'),
      {
        encoding: 'utf8',
        flag: 'r',
      }
    )
    this.filenamesLog = fs.readFileSync(
      path.resolve(__dirname, fixturePath + 'filenames.log'),
      {
        encoding: 'utf8',
        flag: 'r',
      }
    )
    this.secondaryFileLineErrorLog = fs.readFileSync(
      path.resolve(__dirname, fixturePath + 'file-line-error-2.log'),
      {
        encoding: 'utf8',
        flag: 'r',
      }
    )
  })

  it('should parse errors', function () {
    const latexParser = new LatexLogParser(this.errorLog, {
      ignoreDuplicates: true,
    })
    const errors = latexParser.parse().errors

    const expectedErrors = [
      [29, 'Undefined control sequence.'] + '',
      [
        30,
        'LaTeX Error: \\begin{equation} on input line 28 ended by \\end{equaion}.',
      ] + '',
      [30, 'Missing $ inserted.'] + '',
      [30, 'Display math should end with $$.'] + '',
      [46, 'Extra }, or forgotten \\right.'] + '',
      [46, 'Missing \\right. inserted.'] + '',
      [46, 'Missing } inserted.'] + '',
    ]

    expect(errors.length).to.equal(expectedErrors.length)
    for (let i = 0; i < errors.length; i++) {
      expect(
        expectedErrors.indexOf([errors[i].line, errors[i].message] + '')
      ).to.equal(i)
    }
  })

  it('should parse Badbox errors', function () {
    const latexParser = new LatexLogParser(this.badBoxesLog)
    const errors = latexParser.parse().typesetting

    const expectedErrors = [
      [9, 'Overfull \\hbox (29.11179pt too wide) in paragraph at lines 9--10'] +
        '',
      [11, 'Underfull \\hbox (badness 10000) in paragraph at lines 11--13'] +
        '',
      [27, 'Overfull \\vbox (12.00034pt too high) detected at line 27'] + '',
      [46, 'Underfull \\vbox (badness 10000) detected at line 46'] + '',
      [54, 'Underfull \\hbox (badness 10000) in paragraph at lines 54--55'] +
        '',
      [58, 'Underfull \\hbox (badness 10000) in paragraph at lines 58--60'] +
        '',
    ]

    expect(errors.length).to.equal(expectedErrors.length)
    for (let i = 0; i < errors.length; i++) {
      expect(
        expectedErrors.indexOf([errors[i].line, errors[i].message] + '')
      ).to.equal(i)
    }
  })

  it('should parse Warnings', function () {
    const latexParser = new LatexLogParser(this.warningLog)
    const errors = latexParser.parse().warnings

    const expectedErrors = [
      [
        7,
        "Citation `Lambert:2010iw' on page 1 undefined on input line 7.",
        'compiles/d1585ce575dea4cab55f784a22a88652/sections/introduction.tex',
      ] + '',
      [
        7,
        "Citation `Lambert:2010iw' on page 1 undefined on input line 7.",
        'compiles/d1585ce575dea4cab55f784a22a88652/sections/introduction.tex',
      ] + '',
      [
        72,
        "Citation `Manton:2004tk' on page 3 undefined on input line 72.",
        'compiles/d1585ce575dea4cab55f784a22a88652/sections/instantons.tex',
      ] + '',
      [
        108,
        "Citation `Atiyah1978' on page 4 undefined on input line 108.",
        'compiles/d1585ce575dea4cab55f784a22a88652/sections/instantons.tex',
      ] + '',
      [
        176,
        "Citation `Dorey:1996hu' on page 5 undefined on input line 176.",
        'compiles/d1585ce575dea4cab55f784a22a88652/sections/instantons.tex',
      ] + '',
      [
        3,
        "Citation `Manton1982' on page 8 undefined on input line 3.",
        'compiles/d1585ce575dea4cab55f784a22a88652/sections/moduli_space_approximation.tex',
      ] + '',
      [
        21,
        "Citation `Weinberg:2006rq' on page 9 undefined on input line 21.",
        'compiles/d1585ce575dea4cab55f784a22a88652/sections/moduli_space_approximation.tex',
      ] + '',
      [
        192,
        "Citation `Bak:1999sv' on page 12 undefined on input line 192.",
        'compiles/d1585ce575dea4cab55f784a22a88652/sections/moduli_space_approximation.tex',
      ] + '',
      [
        9,
        "Citation `Peeters:2001np' on page 13 undefined on input line 9.",
        'compiles/d1585ce575dea4cab55f784a22a88652/sections/dynamics_of_single_instanton.tex',
      ] + '',
      [
        27,
        "Citation `Osborn:1981yf' on page 15 undefined on input line 27.",
        'compiles/d1585ce575dea4cab55f784a22a88652/sections/dynamics_of_two_instantons.tex',
      ] + '',
      [
        27,
        "Citation `Peeters:2001np' on page 15 undefined on input line 27.",
        'compiles/d1585ce575dea4cab55f784a22a88652/sections/dynamics_of_two_instantons.tex',
      ] + '',
      [
        20,
        "Citation `Osborn:1981yf' on page 22 undefined on input line 20.",
        'compiles/d1585ce575dea4cab55f784a22a88652/sections/appendices.tex',
      ] + '',
      [
        103,
        "Citation `Osborn:1981yf' on page 23 undefined on input line 103.",
        'compiles/d1585ce575dea4cab55f784a22a88652/sections/appendices.tex',
      ] + '',
      [
        103,
        "Citation `Peeters:2001np' on page 23 undefined on input line 103.",
        'compiles/d1585ce575dea4cab55f784a22a88652/sections/appendices.tex',
      ] + '',
      [
        352,
        "Citation `Peeters:2001np' on page 27 undefined on input line 352.",
        'compiles/d1585ce575dea4cab55f784a22a88652/sections/appendices.tex',
      ] + '',
    ]

    // there logs display an additional summary error for undefined references
    const offsetErrorLen = errors.length - 1
    expect(offsetErrorLen).to.equal(expectedErrors.length)

    for (let i = 0; i < offsetErrorLen; i++) {
      expect(expectedErrors[i]).to.equal(
        [errors[i].line, errors[i].message, errors[i].file] + ''
      )
    }
  })

  it('should parse Biber warnings', function () {
    const latexParser = new LatexLogParser(this.biberWarningsLog)
    const errors = latexParser.parse().warnings

    const expectedErrors = [
      [
        null,
        'Package biblatex Warning: No "backend" specified, using Biber backend. To use BibTeX, load biblatex with the "backend=bibtex" option.',
        '/usr/local/texlive/2013/texmf-dist/tex/latex/biblatex/biblatex.sty',
      ] + '',
      [
        null,
        'Package biblatex Warning: The following entry could not be found in the database: Missing3 Please verify the spelling and rerun LaTeX afterwards.',
        '/compile/output.bbl',
      ] + '',
      [
        null,
        'Package biblatex Warning: The following entry could not be found in the database: Missing2 Please verify the spelling and rerun LaTeX afterwards.',
        '/compile/output.bbl',
      ] + '',
      [
        null,
        'Package biblatex Warning: The following entry could not be found in the database: Missing1 Please verify the spelling and rerun LaTeX afterwards.',
        '/compile/output.bbl',
      ] + '',
    ]

    expect(errors.length).to.equal(expectedErrors.length)
    for (let i = 0; i < errors.length; i++) {
      expect(expectedErrors[i]).to.equal(
        [errors[i].line, errors[i].message, errors[i].file] + ''
      )
    }
  })

  it('should parse Natbib warnings', function () {
    const latexParser = new LatexLogParser(this.natbibWarningsLog)
    const errors = latexParser.parse().warnings

    const expectedErrors = [
      [
        6,
        "Package natbib Warning: Citation `blah' on page 1 undefined on input line 6.",
        '/compile/main.tex',
      ] + '',
      [
        null,
        'Package natbib Warning: There were undefined citations.',
        '/compile/main.tex',
      ] + '',
    ]

    expect(errors.length).to.equal(expectedErrors.length)
    for (let i = 0; i < errors.length; i++) {
      expect(expectedErrors[i]).to.equal(
        [errors[i].line, errors[i].message, errors[i].file] + ''
      )
    }
  })

  it('should parse Geometry warnings', function () {
    const latexParser = new LatexLogParser(this.geometryWarningsLog)
    const errors = latexParser.parse().warnings

    const expectedErrors = [
      [
        null,
        "Package geometry Warning: Over-specification in `h'-direction. `width' (597.50787pt) is ignored.",
        '/compile/main.tex',
      ] + '',
      [
        null,
        "Package geometry Warning: Over-specification in `v'-direction. `height' (845.04684pt) is ignored.",
        '/compile/main.tex',
      ] + '',
    ]

    expect(errors.length).to.equal(expectedErrors.length)
    for (let i = 0; i < errors.length; i++) {
      expect(expectedErrors[i]).to.equal(
        [errors[i].line, errors[i].message, errors[i].file] + ''
      )
    }
  })

  it('should parse Caption warnings', function () {
    const latexParser = new LatexLogParser(this.captionWarningsLog)
    const errors = latexParser.parse().warnings

    const expectedErrors = [
      [
        null,
        'Package caption Warning: Unsupported document class (or package) detected, usage of the caption package is not recommended. See the caption package documentation for explanation.',
        '/usr/local/texlive/2014/texmf-dist/tex/latex/caption/caption.sty',
      ] + '',
      [
        46,
        "Package caption Warning: The option `hypcap=true' will be ignored for this particular \\caption on input line 46. See the caption package documentation for explanation.",
        '/compile/main.tex',
      ] + '',
    ]

    expect(errors.length).to.equal(expectedErrors.length)
    for (let i = 0; i < errors.length; i++) {
      expect(expectedErrors[i]).to.equal(
        [errors[i].line, errors[i].message, errors[i].file] + ''
      )
    }
  })

  it('should parse Runaway Arguments', function () {
    const latexParser = new LatexLogParser(this.runawayArgumentsLog)
    const errors = latexParser.parse().errors

    const expectedErrors = [
      [null, 'Runaway argument?', '/compile/runaway_argument.tex'] + '',
      [null, 'Emergency stop.', '/compile/runaway_argument.tex'] + '',
    ]

    expect(errors.length).to.equal(expectedErrors.length)
    for (let i = 0; i < errors.length; i++) {
      expect(expectedErrors[i]).to.equal(
        [errors[i].line, errors[i].message, errors[i].file] + ''
      )
    }
  })

  it('should parse filenames', function () {
    const latexParser = new LatexLogParser(this.filenamesLog)
    const { errors, warnings, typesetting } = latexParser.parse()

    const expectedErrors = [
      [
        1,
        'Undefined control sequence.',
        '/compile/a folder with spaces/a subfolder with spaces/a subsubfolder with spaces/another file with spaces.tex',
      ] + '',
    ]

    const expectedWarnings = [
      [
        9,
        "Citation `Peeters:2001np' on page 13 undefined on input line 9.",
        '/compile/main',
      ] + '',
    ]

    const expectedTypesetting = [
      [
        123,
        'Overfull \\hbox (4.56pt too wide) in paragraph at lines 123--456',
        '/compile/otherfile',
      ] + '',
    ]

    expect(expectedErrors.length).to.equal(errors.length)
    expect(warnings.length).to.equal(warnings.length)
    expect(typesetting.length).to.equal(typesetting.length)

    for (let i = 0; i < errors.length; i++) {
      expect(expectedErrors[i]).to.equal(
        [errors[i].line, errors[i].message, errors[i].file] + ''
      )
    }
    for (let j = 0; j < warnings.length; j++) {
      expect(expectedWarnings[j]).to.equal(
        [warnings[j].line, warnings[j].message, warnings[j].file] + ''
      )
    }
    for (let k = 0; k < typesetting.length; k++) {
      expect(expectedTypesetting[k]).to.equal(
        [typesetting[k].line, typesetting[k].message, typesetting[k].file] + ''
      )
    }
  })

  it('should perform file line error parsing', function () {
    let latexParser = new LatexLogParser(this.fileLineErrorLog)
    let errors = latexParser.parse().errors

    let expectedErrors = [
      [
        1,
        'Undefined control sequence.',
        '/compile/a folder with spaces/a subfolder with spaces/a subsubfolder with spaces/another file with spaces.tex',
      ] + '',
    ]

    expect(errors.length).to.equal(expectedErrors.length)
    for (let i = 0; i < errors.length; i++) {
      expect(expectedErrors[i]).to.equal(
        [errors[i].line, errors[i].message, errors[i].file] + ''
      )
    }

    // again with a more complex example

    latexParser = new LatexLogParser(this.secondaryFileLineErrorLog)
    errors = latexParser.parse().errors

    expectedErrors = [
      [1, 'Misplaced alignment tab character &.', './acks/name.tex'],
      [14, 'Misplaced alignment tab character &.', './main.tex'],
    ]

    expect(errors.length).to.equal(expectedErrors.length)
    for (let i = 0; i < errors.length; i++) {
      expect(expectedErrors[i]).to.deep.equal([
        errors[i].line,
        errors[i].message,
        errors[i].file,
      ])
    }
  })

  it('should ignore duplicates', function () {
    let latexParser = new LatexLogParser(this.errorLog)
    let errors = latexParser.parse().errors

    // duplicates included
    expect(errors.length).to.equal(10)

    latexParser = new LatexLogParser(this.errorLog, { ignoreDuplicates: true })
    errors = latexParser.parse().errors

    // duplicates excluded
    expect(errors.length).to.equal(7)
  })

  it('should get file paths', function () {
    let latexParser = new LatexLogParser(this.errorLog)
    let errors = latexParser.parse().errors

    for (let i = 0; i < errors.length; i++) {
      expect(errors[i].file).to.equal(
        'compiles/dff0c37d892f346e58fc14975a16bf69/sections/appendices.tex'
      )
    }

    latexParser = new LatexLogParser(this.badBoxesLog)
    errors = latexParser.parse().all
    for (let j = 0; j < errors.length; j++) {
      expect(errors[j].file).to.equal(
        'compiles/b6cf470376785e64ad84c57e3296c912/logs/bad-boxes.tex'
      )
    }
  })

  it('should parse a typical biber .blg file', function () {
    const bibParser = new BibLogParser(this.biberBlg, {})
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

  it('should throw an error when non-biblog passed to BibLogParser', function (done) {
    const bibParser = new BibLogParser(this.captionWarningsLog, {})
    try {
      bibParser.parse()
    } catch (e) {
      expect(e).to.exist
      done()
    }
  })

  it('should throw an error when empty string passed to BibLogParser', function (done) {
    const bibParser = new BibLogParser('', {})
    try {
      bibParser.parse()
    } catch (e) {
      expect(e).to.exist
      done()
    }
  })

  it('should throw an error when non-string passed to BibLogParser', function (done) {
    try {
      const bibParser = new BibLogParser({ a: 1 }, {})
      bibParser.parse()
    } catch (e) {
      expect(e).to.exist
      done()
    }
  })

  it('should parse a typical bibtex .blg file', function () {
    const bibParser = new BibLogParser(this.bibtexBlg, {})
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
})
