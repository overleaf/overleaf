import { expect } from 'chai'

import {
  matchOutline,
  nestOutline
} from '../../../../frontend/js/features/outline/outline-parser'

describe.only('OutlineParser', function() {
  describe('matchOutline', function() {
    it('matches all levels', function() {
      const content = `
      \\book{Book}
      \\part{Part}
      \\chapter{Chapter}
      \\section{Section 1}
      \\subsection{Subsection}
      \\subsubsection{Subsubsection}
      \\section{Section 2}
      \\subsubsection{Subsubsection without subsection}
      \\paragraph{a paragraph} Here is some text.
      \\subparagraph{a subparagraph} Here is some more text.
    `
      const outline = matchOutline(content)
      expect(outline).to.deep.equal([
        { line: 2, title: 'Book', level: 10 },
        { line: 3, title: 'Part', level: 20 },
        { line: 4, title: 'Chapter', level: 30 },
        { line: 5, title: 'Section 1', level: 40 },
        { line: 6, title: 'Subsection', level: 50 },
        { line: 7, title: 'Subsubsection', level: 60 },
        { line: 8, title: 'Section 2', level: 40 },
        { line: 9, title: 'Subsubsection without subsection', level: 60 },
        { line: 10, title: 'a paragraph', level: 70 },
        { line: 11, title: 'a subparagraph', level: 80 }
      ])
    })

    it('matches display titles', function() {
      const content = `
      \\section{\\label{foo} Label before}
      \\section{Label after \\label{foo}}
      \\section{Label \\label{foo} between}
      \\section{TT \\texttt{Bar}}
    `
      const outline = matchOutline(content)
      expect(outline).to.deep.equal([
        { line: 2, title: ' Label before', level: 40 },
        { line: 3, title: 'Label after ', level: 40 },
        { line: 4, title: 'Label  between', level: 40 },
        { line: 5, title: 'TT Bar', level: 40 }
      ])
    })

    it('matches empty sections', function() {
      const outline = matchOutline('\\section{}')
      expect(outline).to.deep.equal([{ line: 1, title: '', level: 40 }])
    })

    it('matches indented sections', function() {
      const outline = matchOutline('\t\\section{Indented}')
      expect(outline).to.deep.equal([{ line: 1, title: 'Indented', level: 40 }])
    })

    it('matches unnumbered sections', function() {
      const outline = matchOutline('\\section*{Unnumbered}')
      expect(outline).to.deep.equal([
        { line: 1, title: 'Unnumbered', level: 40 }
      ])
    })

    it('matches short titles', function() {
      const outline = matchOutline(
        '\\chapter[Short Title For TOC]{Very Long Title for Text}'
      )
      expect(outline).to.deep.equal([
        { line: 1, title: 'Short Title For TOC', level: 30 }
      ])
    })

    it('handles spacing', function() {
      const content = `
      \\section {Weird Spacing}
      \\section * {Weird Spacing Unnumbered}
      \\section [Weird Spacing for TOC] {Weird Spacing}
    `
      const outline = matchOutline(content)
      expect(outline).to.deep.equal([
        { line: 2, title: 'Weird Spacing', level: 40 },
        { line: 3, title: 'Weird Spacing Unnumbered', level: 40 },
        { line: 4, title: 'Weird Spacing for TOC', level: 40 }
      ])
    })

    it("doesn't match commented lines", function() {
      const content = `
      % \\section{I should not appear in the outline}
    `
      const outline = matchOutline(content)
      expect(outline).to.deep.equal([])
    })

    it("doesn't match inline sections", function() {
      const content = `
      I like to write \\section{inline} on one line.
    `
      const outline = matchOutline(content)
      expect(outline).to.deep.equal([])
    })
  })

  describe('nestOutline', function() {
    it('matches all levels', function() {
      const flatOutline = [
        { line: 10, title: 'Book', level: 10 },
        { line: 20, title: 'Part A', level: 20 },
        { line: 30, title: 'Section A 1', level: 40 },
        { line: 40, title: 'Subsection A 1 1', level: 50 },
        { line: 50, title: 'Subsection A 1 2', level: 50 },
        { line: 60, title: 'Section A 2', level: 40 },
        { line: 70, title: 'Section A 3', level: 40 },
        { line: 80, title: 'Subsection A 3 1', level: 50 },
        { line: 90, title: 'Chapter', level: 30 },
        { line: 100, title: 'Part B', level: 20 },
        { line: 110, title: 'Section 2', level: 40 },
        { line: 120, title: 'Subsubsection without subsection', level: 60 }
      ]
      const nestedOutline = nestOutline(flatOutline)
      expect(nestedOutline).to.deep.equal([
        {
          line: 10,
          title: 'Book',
          level: 10,
          children: [
            {
              line: 20,
              title: 'Part A',
              level: 20,
              children: [
                {
                  line: 30,
                  title: 'Section A 1',
                  level: 40,
                  children: [
                    { line: 40, title: 'Subsection A 1 1', level: 50 },
                    { line: 50, title: 'Subsection A 1 2', level: 50 }
                  ]
                },
                { line: 60, title: 'Section A 2', level: 40 },
                {
                  line: 70,
                  title: 'Section A 3',
                  level: 40,
                  children: [{ line: 80, title: 'Subsection A 3 1', level: 50 }]
                },
                { line: 90, title: 'Chapter', level: 30 }
              ]
            },
            {
              line: 100,
              title: 'Part B',
              level: 20,
              children: [
                {
                  line: 110,
                  title: 'Section 2',
                  level: 40,
                  children: [
                    {
                      line: 120,
                      title: 'Subsubsection without subsection',
                      level: 60
                    }
                  ]
                }
              ]
            }
          ]
        }
      ])
    })
  })
})
