// Needed since eslint gets confused by mocha-each
/* eslint-disable mocha/prefer-arrow-callback */
import '../../../helpers/bootstrap-3'
import { EditorProviders } from '../../../helpers/editor-providers'
import CodemirrorEditor from '../../../../../frontend/js/features/source-editor/components/codemirror-editor'
import { mockScope } from '../helpers/mock-scope'
import forEach from 'mocha-each'
import { TestContainer } from '../helpers/test-container'

const mountEditor = (content: string | string[]) => {
  if (Array.isArray(content)) {
    content = content.join('\n')
  }
  if (!content.startsWith('\n')) {
    content = '\n' + content
  }
  const scope = mockScope(content)
  scope.editor.showVisual = true
  cy.viewport(1000, 800)
  cy.mount(
    <TestContainer style={{ width: 1000, height: 800 }}>
      <EditorProviders scope={scope}>
        <CodemirrorEditor />
      </EditorProviders>
    </TestContainer>
  )

  // wait for the content to be parsed and revealed
  cy.get('.cm-content').should('have.css', 'opacity', '1')
  cy.get('.cm-line').first().click()
}

function checkTable(
  expected: (string | { text: string; colspan: number })[][]
) {
  cy.get('.table-generator').as('table').should('exist')
  cy.get('@table')
    .find('tbody')
    .as('body')
    .find('tr')
    .should('have.length', expected.length)
  cy.get('@body')
    .find('tr')
    .each((row, rowIndex) => {
      // Add one to the expected length to account for the row selector
      cy.wrap(row)
        .find('.table-generator-cell')
        .as('cells')
        .should('have.length', expected[rowIndex].length)
      cy.get('@cells').each((cell, cellIndex) => {
        const expectation = expected[rowIndex][cellIndex]
        const cellText =
          typeof expectation === 'string' ? expectation : expectation.text
        const colspan =
          typeof expectation === 'string' ? undefined : expectation.colspan
        cy.wrap(cell).should('contain.text', cellText)
        if (colspan) {
          cy.wrap(cell).should('have.attr', 'colspan', colspan.toString())
        }
      })
    })
}

function checkBordersWithNoMultiColumn(
  verticalBorderIndices: boolean[],
  horizontalBorderIndices: boolean[]
) {
  cy.get('.table-generator').as('table').should('have.length', 1)
  cy.get('@table')
    .find('tbody')
    .as('body')
    .find('tr')
    .should('have.length', verticalBorderIndices.length - 1)
    .each((row, rowIndex) => {
      cy.wrap(row)
        .find('.table-generator-cell')
        .should('have.length', horizontalBorderIndices.length - 1)
        .each((cell, cellIndex) => {
          if (cellIndex === 0) {
            cy.wrap(cell).should(
              horizontalBorderIndices[0] ? 'have.class' : 'not.have.class',
              'table-generator-cell-border-left'
            )
          }
          cy.wrap(cell).should(
            horizontalBorderIndices[cellIndex + 1]
              ? 'have.class'
              : 'not.have.class',
            'table-generator-cell-border-right'
          )
          cy.wrap(cell).should(
            verticalBorderIndices[rowIndex] ? 'have.class' : 'not.have.class',
            'table-generator-row-border-top'
          )
          if (rowIndex === verticalBorderIndices.length - 2) {
            cy.wrap(cell).should(
              verticalBorderIndices[rowIndex + 1]
                ? 'have.class'
                : 'not.have.class',
              'table-generator-row-border-bottom'
            )
          }
        })
    })
}

describe('<CodeMirrorEditor/> Table editor', function () {
  beforeEach(function () {
    cy.interceptEvents()

    cy.interceptMathJax()
    cy.interceptCompile('compile', Number.MAX_SAFE_INTEGER)
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
  })

  describe('Table rendering', function () {
    it('Renders a simple table', function () {
      mountEditor(`
\\begin{tabular}{ccc}
  cell 1 & cell 2 & cell 3 \\\\
  cell 4 & cell 5 & cell 6 \\\\
\\end{tabular}`)

      // Find cell in table
      checkTable([
        ['cell 1', 'cell 2', 'cell 3'],
        ['cell 4', 'cell 5', 'cell 6'],
      ])
    })

    it('Renders a table with \\multicolumn', function () {
      mountEditor(`
\\begin{tabular}{ccc}
  \\multicolumn{2}{c}{cell 1 and cell 2} & cell 3 \\\\
  cell 4 & cell 5 & cell 6 \\\\
\\end{tabular}`)

      // Find cell in table
      checkTable([
        [{ text: 'cell 1 and cell 2', colspan: 2 }, 'cell 3'],
        ['cell 4', 'cell 5', 'cell 6'],
      ])
    })

    it('Renders borders', function () {
      mountEditor(`
\\begin{tabular}{c|c}
cell 1 & cell 2 \\\\
\\hline
cell 3 & cell 4 \\\\
\\end{tabular}`)

      checkBordersWithNoMultiColumn([false, true, false], [false, true, false])
    })

    it('Renders math in cells', function () {
      mountEditor(`
\\begin{tabular}{c}
  $\\pi$
\\end{tabular}`)
      cy.get('.MathJax').should('have.text', '$\\pi$')
    })
  })

  describe('The toolbar', function () {
    it('Renders the toolbar when the table is selected', function () {
      mountEditor(`
\\begin{tabular}{c}
    cell
\\end{tabular}
      `)
      cy.get('.table-generator-floating-toolbar').should('not.exist')
      cy.get('.table-generator-cell').click()
      cy.get('.table-generator-floating-toolbar').should('exist')
      // The element is partially covered, but we can still click it
      cy.get('.cm-line').first().click({ force: true })
      cy.get('.table-generator-floating-toolbar').should('not.exist')
    })

    it('Adds and removes borders when theme is changed', function () {
      mountEditor(`
\\begin{tabular}{c|c}
    cell 1 & cell 2 \\\\
    cell 3 & cell 4 \\\\
\\end{tabular}
`)
      checkBordersWithNoMultiColumn([false, false, false], [false, true, false])
      cy.get('.table-generator-floating-toolbar').should('not.exist')
      cy.get('.table-generator-cell').first().click()
      cy.get('.table-generator-floating-toolbar').as('toolbar').should('exist')
      cy.get('@toolbar').findByText('Custom borders').click({ force: true })
      cy.get('.table-generator').findByText('All borders').click()
      // The element is partially covered, but we can still click it
      cy.get('.cm-line').first().click({ force: true })
      // Table should be unchanged
      checkTable([
        ['cell 1', 'cell 2'],
        ['cell 3', 'cell 4'],
      ])
      checkBordersWithNoMultiColumn([true, true, true], [true, true, true])

      cy.get('.table-generator-cell').first().click()
      cy.get('@toolbar').findByText('All borders').click()
      cy.get('.table-generator').findByText('No borders').click()
      // The element is partially covered, but we can still click it
      cy.get('.cm-line').first().click({ force: true })
      // Table should be unchanged
      checkTable([
        ['cell 1', 'cell 2'],
        ['cell 3', 'cell 4'],
      ])
      checkBordersWithNoMultiColumn(
        [false, false, false],
        [false, false, false]
      )
    })

    it('Changes the column alignment with dropdown buttons', function () {
      mountEditor(`
\\begin{tabular}{cc}
    cell 1 & cell 2 \\\\
    cell 3 & cell 4 \\\\
\\end{tabular}
      `)

      cy.get('.table-generator-cell')
        .should('have.class', 'alignment-center')
        .first()
        .click()

      cy.get('.table-generator-floating-toolbar').as('toolbar').should('exist')
      cy.get('@toolbar')
        .findByLabelText('Alignment')
        .should('be.disabled')
        .should('contain.text', 'format_align_center')

      cy.get('.column-selector').first().click()
      cy.get('@toolbar')
        .findByLabelText('Alignment')
        .should('not.be.disabled')
        .click()
      cy.get('.table-generator').findByLabelText('Left').click()
      // The element is partially covered, but we can still click it
      cy.get('.cm-line').first().click({ force: true })
      // Table contents shouldn't have changed
      checkTable([
        ['cell 1', 'cell 2'],
        ['cell 3', 'cell 4'],
      ])
      // Check that alignment button updated to reflect the left alignment
      cy.get('.table-generator-cell').first().click()
      cy.get('@toolbar')
        .findByLabelText('Alignment')
        .should('be.disabled')
        .should('contain.text', 'format_align_left')

      cy.get('.table-generator-cell')
        .eq(0)
        .should('have.class', 'alignment-left')
      cy.get('.table-generator-cell')
        .eq(1)
        .should('have.class', 'alignment-center')
      cy.get('.table-generator-cell')
        .eq(2)
        .should('have.class', 'alignment-left')
      cy.get('.table-generator-cell')
        .eq(3)
        .should('have.class', 'alignment-center')
    })

    it('Removes rows and columns', function () {
      mountEditor(`
\\begin{tabular}{|c|c|c|}
    \\hline
    cell 1 & cell 2 & cell 3 \\\\ \\hline
    cell 4 & cell 5 & cell 6 \\\\ \\hline
    cell 7 & cell 8 & cell 9 \\\\ \\hline
\\end{tabular}
      `)
      checkTable([
        ['cell 1', 'cell 2', 'cell 3'],
        ['cell 4', 'cell 5', 'cell 6'],
        ['cell 7', 'cell 8', 'cell 9'],
      ])
      cy.get('.table-generator-cell').first().click()
      cy.get('.table-generator-floating-toolbar').as('toolbar').should('exist')
      cy.get('@toolbar')
        .findByLabelText('Delete row or column')
        .should('be.disabled')
      cy.get('.column-selector').eq(1).click()
      cy.get('@toolbar').findByLabelText('Delete row or column').click()
      checkTable([
        ['cell 1', 'cell 3'],
        ['cell 4', 'cell 6'],
        ['cell 7', 'cell 9'],
      ])
      cy.get('.row-selector').eq(2).click()
      cy.get('@toolbar').findByLabelText('Delete row or column').click()
      checkTable([
        ['cell 1', 'cell 3'],
        ['cell 4', 'cell 6'],
      ])
      checkBordersWithNoMultiColumn([true, true, true], [true, true, true])
    })

    it('Removes rows correctly when removing from the left', function () {
      mountEditor(`
\\begin{tabular}{|c|c|c|}\\hline
    cell 1&cell 2&cell 3 \\\\\\hline
\\end{tabular}
      `)
      checkTable([['cell 1', 'cell 2', 'cell 3']])
      cy.get('.table-generator').findByText('cell 1').click()
      cy.get('.table-generator')
        .findByText('cell 1')
        .type('{shift}{rightarrow}')
      cy.get('.table-generator-floating-toolbar').as('toolbar').should('exist')
      cy.get('@toolbar')
        .findByLabelText('Delete row or column')
        .should('be.enabled')
      cy.get('@toolbar').findByLabelText('Delete row or column').click()
      checkTable([['cell 3']])
      checkBordersWithNoMultiColumn([true, true], [true, true])
    })

    it('Merges and unmerged cells', function () {
      mountEditor(`
\\begin{tabular}{ccc}
    cell 1 & cell 2 & cell 3 \\\\
    cell 4 & cell 5 & cell 6 \\\\
\\end{tabular}
      `)
      cy.get('.table-generator-cell').first().click()
      cy.get('.table-generator-cell').first().type('{shift}{rightarrow}')
      cy.get('.table-generator-floating-toolbar').as('toolbar').should('exist')
      cy.get('@toolbar').findByLabelText('Merge cells').click()
      checkTable([
        [{ text: 'cell 1 cell 2', colspan: 2 }, 'cell 3'],
        ['cell 4', 'cell 5', 'cell 6'],
      ])
      cy.get('@toolbar').findByLabelText('Unmerge cells').click()
      checkTable([
        ['cell 1 cell 2', '', 'cell 3'],
        ['cell 4', 'cell 5', 'cell 6'],
      ])
    })

    it('Adds rows and columns', function () {
      mountEditor(`
\\begin{tabular}{c}
    cell 1
\\end{tabular}
      `)
      cy.get('.table-generator').findByText('cell 1').click()
      cy.get('.table-generator-floating-toolbar').as('toolbar').should('exist')

      // Set border theme to "All borders" so that we can check that theme is
      // preserved when adding new rows and columns
      cy.get('@toolbar').findByText('No borders').click()
      cy.get('.table-generator').findByText('All borders').click()

      cy.get('.table-generator').findByText('cell 1').click()
      cy.get('@toolbar').findByLabelText('Insert').click()
      cy.get('.table-generator').findByText('Insert column left').click()
      checkTable([['', 'cell 1']])
      checkBordersWithNoMultiColumn([true, true], [true, true, true])

      cy.get('.table-generator').findByText('cell 1').click()
      cy.get('@toolbar').findByLabelText('Insert').click()
      cy.get('.table-generator').findByText('Insert column right').click()
      checkTable([['', 'cell 1', '']])
      checkBordersWithNoMultiColumn([true, true], [true, true, true, true])

      cy.get('.table-generator').findByText('cell 1').click()
      cy.get('@toolbar').findByLabelText('Insert').click()
      cy.get('.table-generator').findByText('Insert row above').click()
      checkTable([
        ['', '', ''],
        ['', 'cell 1', ''],
      ])
      checkBordersWithNoMultiColumn(
        [true, true, true],
        [true, true, true, true]
      )

      cy.get('.table-generator').findByText('cell 1').click()
      cy.get('@toolbar').findByLabelText('Insert').click()
      cy.get('.table-generator').findByText('Insert row below').click()
      checkTable([
        ['', '', ''],
        ['', 'cell 1', ''],
        ['', '', ''],
      ])
      checkBordersWithNoMultiColumn(
        [true, true, true, true],
        [true, true, true, true]
      )
    })

    it('Removes the table on toolbar button click', function () {
      mountEditor(`
\\begin{tabular}{c}
    cell 1
\\end{tabular}`)
      cy.get('.table-generator').findByText('cell 1').click()
      cy.get('.table-generator-floating-toolbar').as('toolbar').should('exist')
      cy.get('@toolbar').findByLabelText('Delete table').click()
      cy.get('.table-generator').should('not.exist')
    })

    it('Moves the caption when using dropdown', function () {
      mountEditor(`
\\begin{table}
  \\caption{Table caption}
  \\label{tab:table}
  \\begin{tabular}{c}
    cell 1
  \\end{tabular}
\\end{table}`)
      cy.get('.table-generator').findByText('cell 1').click()
      cy.get('.table-generator-floating-toolbar').as('toolbar').should('exist')
      cy.get('@toolbar').findByText('Caption above').click()
      cy.get('.table-generator-toolbar-dropdown-menu')
        .findByText('Caption below')
        .click()
      // Check that caption is below table
      cy.get('.ol-cm-command-caption').then(([caption]) => {
        const { top: captionYPosition } = caption.getBoundingClientRect()
        cy.get('.table-generator').then(([table]) => {
          const { top: tableYPosition } = table.getBoundingClientRect()
          cy.wrap(captionYPosition).should('be.greaterThan', tableYPosition)
        })
      })

      cy.get('@toolbar').findByText('Caption below').click()
      cy.get('.table-generator-toolbar-dropdown-menu')
        .findByText('Caption above')
        .click()
      // Check that caption is above table
      cy.get('.ol-cm-command-caption').then(([caption]) => {
        const { top: captionYPosition } = caption.getBoundingClientRect()
        cy.get('.table-generator').then(([table]) => {
          const { top: tableYPosition } = table.getBoundingClientRect()
          cy.wrap(captionYPosition).should('be.lessThan', tableYPosition)
        })
      })

      // Removes caption when clicking "No caption"
      cy.get('@toolbar').findByText('Caption above').click()
      cy.get('.table-generator-toolbar-dropdown-menu')
        .findByText('No caption')
        .click()
      cy.get('@toolbar').findByText('No caption').should('exist')
      cy.get('.ol-cm-command-caption').should('not.exist')
      cy.get('.ol-cm-command-label').should('not.exist')
    })

    it('Renders a table with custom column spacing', function () {
      mountEditor(`
\\begin{tabular}{@{}c@{}l!{}}
  cell 1 & cell 2 \\\\
  cell 3 & cell 4 \\\\
\\end{tabular}`)
      checkTable([
        ['cell 1', 'cell 2'],
        ['cell 3', 'cell 4'],
      ])
      cy.get('.table-generator-cell').first().click()
      cy.get('.table-generator-floating-toolbar').as('toolbar').should('exist')
      cy.get('@toolbar').findByText('No borders').click()
      cy.get('.table-generator').findByText('All borders').click()
      // The element is partially covered, but we can still click it
      cy.get('.cm-line').first().click({ force: true })
      checkTable([
        ['cell 1', 'cell 2'],
        ['cell 3', 'cell 4'],
      ])
      checkBordersWithNoMultiColumn([true, true, true], [true, true, true])
    })

    it('Disables caption dropdown when not directly inside table environment', function () {
      mountEditor(`
\\begin{table}
  \\caption{Table caption}
  \\label{tab:table}
  \\begin{adjustbox}{max width=\\textwidth}
    \\begin{tabular}{c}
      cell 1
    \\end{tabular}
  \\end{adjustbox}
\\end{table}`)
      cy.get('.table-generator').findByText('cell 1').click()
      cy.get('.table-generator-floating-toolbar').as('toolbar').should('exist')
      cy.get('@toolbar')
        .contains('button', 'Caption above')
        .should('be.disabled')
    })

    describe('Fixed width columns', function () {
      it('Can add fixed width columns', function () {
        // Check that no column indicators exist
        mountEditor(`
        \\begin{tabular}{cc}
        cell 1 & cell 2\\\\
        cell 3 & cell 4 \\\\
        \\end{tabular}`)
        cy.get('.table-generator-column-indicator-label').should('not.exist')
        cy.get('.table-generator-cell').eq(0).as('cell')
        // Activate the table
        cy.get('@cell').click()
        cy.get('.table-generator-floating-toolbar')
          .as('toolbar')
          .should('exist')
        // Select the second column
        cy.get('.column-selector').eq(1).click()
        cy.get('@toolbar').findByLabelText('Adjust column width').click()
        cy.get('.table-generator-toolbar-dropdown-menu')
          .findByText('Fixed width, wrap text')
          .click()
        // The modal should be open
        cy.get('.table-generator-width-modal').as('modal').should('be.visible')
        // The width input should be focused
        cy.get('@modal')
          .get('#column-width-modal-width')
          .should('be.focused')
          .type('20')
        // Change the unit to inches
        cy.get('@modal').findAllByLabelText('Length unit').first().click()
        cy.get('@modal')
          .findByRole('listbox')
          .as('dropdown')
          .should('be.visible')
        cy.get('@dropdown').findByText('in').click()
        // Confirm the change
        cy.get('@modal').findByText('OK').click()
        // Modal should close
        cy.get('@modal').should('not.exist')
        // Check that the width is applied to the right column
        cy.get('.table-generator-column-widths-row td')
          // 3rd element (buffer, column 1, column 2)
          .eq(2)
          .should('contain.text', '20in')
      })

      forEach([
        ['20in', 'in'],
        ['20', 'Custom'],
        ['\\foobar', 'Custom'],
      ]).it(
        `Understands '%s' width descriptor`,
        function (width, expectedUnit) {
          // Check that no column indicators exist
          mountEditor(`
          \\begin{tabular}{cp{${width}}}
          cell 1 & cell 2\\\\
          cell 3 & cell 4 \\\\
          \\end{tabular}`)
          // Activate the table
          cy.get('.table-generator-cell').eq(0).click()
          // Click the column width indicator
          cy.get('.table-generator-column-indicator-label').click()
          // The modal should be open
          cy.get('.table-generator-width-modal')
            .as('modal')
            .should('be.visible')
          cy.get('@modal')
            .findAllByLabelText('Length unit')
            .first()
            .should('have.text', expectedUnit)
          cy.get('@modal').findByText('Cancel').click()
        }
      )

      it(`It can justify fixed width cells`, function () {
        // Check that no column indicators exist
        mountEditor(`
        \\begin{tabular}{>{\\raggedright\\arraybackslash}p{2cm}c}
        cell 1 & cell 2\\\\
        cell 3 & cell 4 \\\\
        \\end{tabular}`)
        // Activate the table
        cy.get('.table-generator-cell').eq(0).click()
        cy.get('.table-generator-floating-toolbar')
          .as('toolbar')
          .should('exist')
        // Select the first column
        cy.get('.column-selector').first().click()
        // Verify current alignment is left, and open the menu
        cy.get('@toolbar')
          .findByLabelText('Alignment')
          .should('not.be.disabled')
          .should('contain.text', 'format_align_left')
          .click()
        // Change to justified alignment
        cy.get('.table-generator').findByLabelText('Justify').click()
        // Verify that alignment icon and class alignments were updated
        cy.get('@toolbar')
          .findByLabelText('Alignment')
          .should('contain.text', 'format_align_justify')
        cy.get('.table-generator-cell')
          .eq(0)
          .should('have.class', 'alignment-paragraph')
        cy.get('.table-generator-cell')
          .eq(1)
          .should('have.class', 'alignment-center')
        cy.get('.table-generator-cell')
          .eq(2)
          .should('have.class', 'alignment-paragraph')
        cy.get('.table-generator-cell')
          .eq(3)
          .should('have.class', 'alignment-center')
      })
    })
  })

  describe('Tabular interactions', function () {
    it('Can type into cells', function () {
      mountEditor(`
      \\begin{tabular}{cccc}
        cell 1 & cell 2 & cell 3 & cell 4\\\\
        cell 5 & \\multicolumn{2}{c}cell 6} & cell 7 \\\\
      \\end{tabular}`)

      cy.get('.table-generator-cell').eq(0).as('cell-1')
      cy.get('.table-generator-cell').eq(5).as('cell-6')

      // Escape should cancel editing
      cy.get('@cell-1').type('foo{Esc}')
      cy.get('@cell-1').should('have.text', 'cell 1')

      // Enter should commit change. Direct typing should override the current contents
      cy.get('@cell-1').type('foo{Enter}')
      cy.get('@cell-1').should('have.text', 'foo')

      // Enter should start editing at the end of current text
      cy.get('@cell-1').type('{Enter}')
      cy.get('@cell-1').find('textarea').should('exist')
      cy.get('@cell-1').type('bar{Enter}')
      cy.get('@cell-1').should('have.text', 'foobar')

      // Double clicking should start editing at the end of current text
      cy.get('@cell-1').dblclick()
      cy.get('@cell-1').find('textarea').should('exist')
      cy.get('@cell-1').type('baz{Enter}')
      cy.get('@cell-1').should('have.text', 'foobarbaz')

      cy.get('@cell-1').type('{Backspace}')
      cy.get('@cell-1').should('have.text', '')

      // Typing also works for multicolumn cells
      cy.get('@cell-6').type('foo{Enter}')
      checkTable([
        ['', 'cell 2', 'cell 3', 'cell 4'],
        ['cell 5', { text: 'foo', colspan: 2 }, 'cell 7'],
      ])
    })

    it('Can paste tabular data into cells', function () {
      mountEditor(`
      \\begin{tabular}{cc }
        cell 1 & cell 2\\\\
        cell 3 & cell 4 \\\\
      \\end{tabular}`)
      cy.get('.table-generator-cell').eq(0).as('cell-1')
      // TODO: Seems as cypress can't access clipboard, so we can't test copying
      cy.get('@cell-1').click()
      const clipboardData = new DataTransfer()
      clipboardData.setData('text/plain', 'foo\tbar\nbaz\tqux')
      cy.get('@cell-1').trigger('paste', { clipboardData })
      checkTable([
        ['foo', 'bar'],
        ['baz', 'qux'],
      ])
    })

    it('Can navigate cells with keyboard', function () {
      mountEditor(`
      \\begin{tabular}{cc }
        cell 1 & cell 2\\\\
        cell 3 & cell 4 \\\\
      \\end{tabular}`)
      cy.get('.table-generator-cell').eq(0).as('cell-1')
      cy.get('.table-generator-cell').eq(1).as('cell-2')
      cy.get('.table-generator-cell').eq(2).as('cell-3')
      cy.get('.table-generator-cell').eq(3).as('cell-4')

      // Arrow key navigation
      cy.get('@cell-1').click()
      cy.get('@cell-1').type('{rightarrow}')
      cy.get('@cell-2').should('have.focus').should('have.class', 'selected')
      cy.get('@cell-2').type('{leftarrow}')
      cy.get('@cell-1').should('have.focus').should('have.class', 'selected')
      cy.get('@cell-1').type('{downarrow}')
      cy.get('@cell-3').should('have.focus').should('have.class', 'selected')
      cy.get('@cell-3').type('{rightarrow}')
      cy.get('@cell-4').should('have.focus').should('have.class', 'selected')
      cy.get('@cell-4').type('{uparrow}')
      cy.get('@cell-2').should('have.focus').should('have.class', 'selected')
      cy.get('@cell-2').type('{leftarrow}')
      cy.get('@cell-1').should('have.focus').should('have.class', 'selected')

      // Tab navigation
      cy.get('@cell-1').tab()
      cy.get('@cell-2').should('have.focus').should('have.class', 'selected')
      cy.get('@cell-2').tab()
      cy.get('@cell-3').should('have.focus').should('have.class', 'selected')
      cy.get('@cell-3').tab()
      cy.get('@cell-4').should('have.focus').should('have.class', 'selected')
      cy.get('@cell-4').tab({ shift: true })
      cy.get('@cell-3').should('have.focus').should('have.class', 'selected')
      cy.get('@cell-3').tab({ shift: true })
      cy.get('@cell-2').should('have.focus').should('have.class', 'selected')
      cy.get('@cell-2').tab({ shift: true })
      cy.get('@cell-1').should('have.focus').should('have.class', 'selected')
      // Tabbing when editing a cell should commit change and move to next cell
      cy.get('@cell-1').type('foo')
      cy.get('@cell-1').tab()
      cy.get('@cell-2').should('have.focus').should('have.class', 'selected')
      cy.get('@cell-1').should('have.text', 'foo')
    })

    it('Can select rows and columns with selectors', function () {
      mountEditor(`
\\begin{tabular}{cc }
  cell 1 & cell 2\\\\
  cell 3 & cell 4 \\\\
\\end{tabular}`)
      cy.get('.table-generator-cell').eq(0).as('cell-1')
      cy.get('.table-generator-cell').eq(1).as('cell-2')
      cy.get('.table-generator-cell').eq(2).as('cell-3')
      cy.get('.table-generator-cell').eq(3).as('cell-4')

      cy.get('.column-selector').eq(0).click()
      cy.get('@cell-1').should('have.class', 'selected')
      cy.get('@cell-2').should('not.have.class', 'selected')
      cy.get('@cell-3').should('have.class', 'selected')
      cy.get('@cell-4').should('not.have.class', 'selected')
      cy.get('.column-selector').eq(1).click()
      cy.get('@cell-1').should('not.have.class', 'selected')
      cy.get('@cell-2').should('have.class', 'selected')
      cy.get('@cell-3').should('not.have.class', 'selected')
      cy.get('@cell-4').should('have.class', 'selected')
      cy.get('.column-selector').eq(0).click({ shiftKey: true })
      cy.get('@cell-1').should('have.class', 'selected')
      cy.get('@cell-2').should('have.class', 'selected')
      cy.get('@cell-3').should('have.class', 'selected')
      cy.get('@cell-4').should('have.class', 'selected')

      cy.get('.row-selector').eq(0).click()
      cy.get('@cell-1').should('have.class', 'selected')
      cy.get('@cell-2').should('have.class', 'selected')
      cy.get('@cell-3').should('not.have.class', 'selected')
      cy.get('@cell-4').should('not.have.class', 'selected')
      cy.get('.row-selector').eq(1).click()
      cy.get('@cell-1').should('not.have.class', 'selected')
      cy.get('@cell-2').should('not.have.class', 'selected')
      cy.get('@cell-3').should('have.class', 'selected')
      cy.get('@cell-4').should('have.class', 'selected')
      cy.get('.row-selector').eq(0).click({ shiftKey: true })
      cy.get('@cell-1').should('have.class', 'selected')
      cy.get('@cell-2').should('have.class', 'selected')
      cy.get('@cell-3').should('have.class', 'selected')
      cy.get('@cell-4').should('have.class', 'selected')
    })

    it('Allow compilation shortcuts to work', function () {
      mountEditor(`
\\begin{tabular}{cc }
cell 1 & cell 2\\\\
cell 3 & cell 4 \\\\
\\end{tabular}`)
      cy.get('.table-generator-cell').eq(0).as('cell-1').click()
      cy.get('@cell-1').type('{ctrl}{enter}')
      cy.wait('@compile')
      cy.get('@cell-1').type('foo{ctrl}{enter}')
      cy.wait('@compile')
      cy.get('@cell-1').type('{esc}')
      cy.get('@cell-1').type('{ctrl}{s}')
      cy.wait('@compile')
      cy.get('@cell-1').type('foo{ctrl}{s}')
      cy.wait('@compile')
    })
  })
})
