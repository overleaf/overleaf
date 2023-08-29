import { FC } from 'react'
import { EditorProviders } from '../../../helpers/editor-providers'
import CodemirrorEditor from '../../../../../frontend/js/features/source-editor/components/codemirror-editor'
import { mockScope } from '../helpers/mock-scope'

const Container: FC = ({ children }) => (
  <div style={{ width: 785, height: 785 }}>{children}</div>
)

const mountEditor = (content: string | string[]) => {
  if (Array.isArray(content)) {
    content = content.join('\n')
  }
  if (!content.startsWith('\n')) {
    content = '\n' + content
  }
  const scope = mockScope(content)
  scope.editor.showVisual = true

  cy.mount(
    <Container>
      <EditorProviders scope={scope}>
        <CodemirrorEditor />
      </EditorProviders>
    </Container>
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
    cy.interceptSpelling()
    cy.interceptMathJax()
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    window.metaAttributesCache.set('ol-splitTestVariants', {
      'table-generator': 'enabled',
    })
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
      cy.get('@toolbar').findByText('Custom borders').click()
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
      cy.get('@toolbar').findByLabelText('Alignment').should('be.disabled')
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
\\begin{tabular}{ccc}
    cell 1 & cell 2 & cell 3 \\\\
    cell 4 & cell 5 & cell 6 \\\\
    cell 7 & cell 8 & cell 9 \\\\
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
      cy.get('.row-selector').eq(1).click()
      cy.get('@toolbar').findByLabelText('Delete row or column').click()
      checkTable([
        ['cell 1', 'cell 3'],
        ['cell 7', 'cell 9'],
      ])
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

      cy.get('.table-generator').findByText('cell 1').click()
      cy.get('@toolbar').findByLabelText('Insert').click()
      cy.get('.table-generator').findByText('Insert column left').click()
      checkTable([['', 'cell 1']])

      cy.get('.table-generator').findByText('cell 1').click()
      cy.get('@toolbar').findByLabelText('Insert').click()
      cy.get('.table-generator').findByText('Insert column right').click()
      checkTable([['', 'cell 1', '']])

      cy.get('.table-generator').findByText('cell 1').click()
      cy.get('@toolbar').findByLabelText('Insert').click()
      cy.get('.table-generator').findByText('Insert row above').click()
      checkTable([
        ['', '', ''],
        ['', 'cell 1', ''],
      ])

      cy.get('.table-generator').findByText('cell 1').click()
      cy.get('@toolbar').findByLabelText('Insert').click()
      cy.get('.table-generator').findByText('Insert row below').click()
      checkTable([
        ['', '', ''],
        ['', 'cell 1', ''],
        ['', '', ''],
      ])
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

      // Removes caption when clicking "No caption"
      cy.get('@toolbar').findByText('Caption below').click()
      cy.get('.table-generator-toolbar-dropdown-menu')
        .findByText('No caption')
        .click()
      cy.get('@toolbar').findByText('No caption').should('exist')
      cy.get('.ol-cm-command-caption').should('not.exist')
      cy.get('.ol-cm-command-label').should('not.exist')
    })
  })
})
