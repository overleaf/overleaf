import DocumentDiffViewer from '../../../../../frontend/js/features/history/components/diff-view/document-diff-viewer'
import { Highlight } from '../../../../../frontend/js/features/history/services/types/doc'
import { FC } from 'react'
import { EditorProviders } from '../../../helpers/editor-providers'

const doc = `\\documentclass{article}

% Language setting
% Replace \`english' with e.g. \`spanish' to change the document language
\\usepackage[english]{babel}

% Set page size and margins
% Replace \`letterpaper' with \`a4paper' for UK/EU standard size
\\usepackage[letterpaper,top=2cm,bottom=2cm,left=3cm,right=3cm,marginparwidth=1.75cm]{geometry}

% Useful packages
\\usepackage{amsmath}
\\usepackage{graphicx}
\\usepackage[colorlinks=true, allcolors=blue]{hyperref}

\\title{Your Paper}
\\author{You}

\\begin{document}
\\maketitle

\\begin{abstract}
Your abstract.
\\end{abstract}

\\section{Introduction}

Your introduction goes here! Simply start writing your document and use the Recompile button to view the updated PDF preview. Examples of commonly used commands and features are listed below, to help you get started.

Once you're familiar with the editor, you can find various project settings in the Overleaf menu, accessed via the button in the very top left of the editor. To view tutorials, user guides, and further documentation, please visit our \\href{https://www.overleaf.com/learn}{help library}, or head to our plans page to \\href{https://www.overleaf.com/user/subscription/plans}{choose your plan}.

${'\n'.repeat(200)}

\\end{document}`

const highlights: Highlight[] = [
  {
    type: 'addition',
    range: { from: 15, to: 22 },
    hue: 200,
    label: 'Added by Wombat on Monday',
  },
  {
    type: 'deletion',
    range: { from: 27, to: 35 },
    hue: 200,
    label: 'Deleted by Wombat on Tuesday',
  },
  {
    type: 'addition',
    range: { from: doc.length - 9, to: doc.length - 1 },
    hue: 200,
    label: 'Added by Wombat on Wednesday',
  },
]

const Container: FC<React.PropsWithChildren> = ({ children }) => (
  <div style={{ width: 600, height: 400 }}>{children}</div>
)

const mockScope = () => {
  return {
    settings: {
      fontSize: 12,
      fontFamily: 'monaco',
      lineHeight: 'normal',
      overallTheme: '',
    },
  }
}

describe('document diff viewer', function () {
  it('displays highlights with hover tooltips', function () {
    const scope = mockScope()

    cy.mount(
      <Container>
        <EditorProviders scope={scope}>
          <DocumentDiffViewer doc={doc} highlights={highlights} />
        </EditorProviders>
      </Container>
    )

    cy.get('.ol-cm-addition-marker').should('have.length', 1)
    cy.get('.ol-cm-addition-marker').first().as('addition')
    cy.get('@addition').should('have.text', 'article')

    cy.get('.ol-cm-deletion-marker').should('have.length', 1)
    cy.get('.ol-cm-deletion-marker').first().as('deletion')
    cy.get('@deletion').should('have.text', 'Language')

    // Check hover tooltips
    cy.get('@addition').trigger('mouseover')
    cy.get('.ol-cm-highlight-tooltip').should('have.length', 1)
    cy.get('.ol-cm-highlight-tooltip')
      .first()
      .should('have.text', 'Added by Wombat on Monday')

    cy.get('@deletion').trigger('mouseover')
    cy.get('.ol-cm-highlight-tooltip').should('have.length', 1)
    cy.get('.ol-cm-highlight-tooltip')
      .first()
      .should('have.text', 'Deleted by Wombat on Tuesday')
  })

  it('displays highlights with hover tooltips for empty lines', function () {
    const scope = mockScope()

    const doc = `1
Addition


End
2
Deletion

End
3`
    const highlights: Highlight[] = [
      {
        type: 'addition',
        range: { from: 2, to: 16 },
        hue: 200,
        label: 'Added by Wombat on Monday',
      },
      {
        type: 'deletion',
        range: { from: 19, to: 32 },
        hue: 200,
        label: 'Deleted by Wombat on Tuesday',
      },
    ]

    cy.mount(
      <Container>
        <EditorProviders scope={scope}>
          <DocumentDiffViewer doc={doc} highlights={highlights} />
        </EditorProviders>
      </Container>
    )

    cy.get('.ol-cm-empty-line-addition-marker').should('have.length', 2)
    cy.get('.ol-cm-empty-line-deletion-marker').should('have.length', 1)

    // For an empty line marker, we need to trigger mouseover on the containing
    // line beause the marker itself does not trigger mouseover
    cy.get('.ol-cm-empty-line-addition-marker')
      .first()
      .parent()
      .as('firstAdditionLine')
    cy.get('.ol-cm-empty-line-addition-marker')
      .first()
      .parent()
      .as('lastAdditionLine')
    cy.get('.ol-cm-empty-line-deletion-marker')
      .last()
      .parent()
      .as('deletionLine')

    // Check hover tooltips
    cy.get('@lastAdditionLine').trigger('mouseover')
    cy.get('.ol-cm-highlight-tooltip').should('have.length', 1)
    cy.get('.ol-cm-highlight-tooltip')
      .first()
      .should('have.text', 'Added by Wombat on Monday')

    cy.get('@lastAdditionLine').trigger('mouseleave')

    cy.get('@firstAdditionLine').trigger('mouseover')
    cy.get('.ol-cm-highlight-tooltip').should('have.length', 1)
    cy.get('.ol-cm-highlight-tooltip')
      .first()
      .should('have.text', 'Added by Wombat on Monday')

    cy.get('@deletionLine').trigger('mouseover')
    cy.get('.ol-cm-highlight-tooltip').should('have.length', 1)
    cy.get('.ol-cm-highlight-tooltip')
      .first()
      .should('have.text', 'Deleted by Wombat on Tuesday')
  })

  it("renders 'More updates' buttons", function () {
    const scope = mockScope()

    cy.mount(
      <Container>
        <EditorProviders scope={scope}>
          <DocumentDiffViewer doc={doc} highlights={highlights} />
        </EditorProviders>
      </Container>
    )

    cy.get('.cm-scroller').first().as('scroller')

    // Check the initial state, which should be a "More updates below" button
    // but no "More updates above", with the editor scrolled to the top
    cy.get('.ol-cm-addition-marker').should('have.length', 1)
    cy.get('.ol-cm-deletion-marker').should('have.length', 1)
    cy.get('.previous-highlight-button').should('have.length', 0)
    cy.get('.next-highlight-button').should('have.length', 1)
    cy.get('@scroller').invoke('scrollTop').should('equal', 0)

    // Click the "More updates below" button, which should scroll the editor,
    // and check the new state
    cy.get('.next-highlight-button').first().click()

    cy.get('@scroller').invoke('scrollTop').should('not.equal', 0)
    cy.get('.previous-highlight-button').should('have.length', 1)
    cy.get('.next-highlight-button').should('have.length', 0)

    // Click the "More updates above" button, which should scroll the editor up
    // but not quite to the top, and check the new state
    cy.get('.previous-highlight-button').first().click()
    cy.get('@scroller').invoke('scrollTop').should('equal', 0)
    cy.get('.previous-highlight-button').should('not.exist')
    cy.get('.next-highlight-button').should('have.length', 1)
  })

  it('scrolls to first change', function () {
    const scope = mockScope()
    const finalHighlightOnly = highlights.slice(-1)

    cy.mount(
      <Container>
        <EditorProviders scope={scope}>
          <DocumentDiffViewer doc={doc} highlights={finalHighlightOnly} />
        </EditorProviders>
      </Container>
    )

    cy.get('.cm-scroller').first().invoke('scrollTop').should('not.equal', 0)
    cy.get('.ol-cm-addition-marker')
      .first()
      .then($marker => {
        cy.get('.cm-content')
          .first()
          .then($content => {
            const contentRect = $content[0].getBoundingClientRect()
            const markerRect = $marker[0].getBoundingClientRect()
            expect(markerRect.top).to.be.within(
              contentRect.top,
              contentRect.bottom
            )
            expect(markerRect.bottom).to.be.within(
              contentRect.top,
              contentRect.bottom
            )
          })
      })
  })
})
