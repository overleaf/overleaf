import OutlinePane from '@/features/outline/components/outline-pane'
import { EditorProviders, PROJECT_ID } from '../../../helpers/editor-providers'
import { useState } from 'react'
import customLocalStorage from '@/infrastructure/local-storage'

describe('<OutlinePane />', function () {
  it('renders expanded outline', function () {
    cy.mount(
      <EditorProviders>
        <OutlinePane
          isTexFile
          outline={[{ title: 'Section', line: 1, level: 10 }]}
          jumpToLine={cy.stub()}
          onToggle={cy.stub()}
          expanded
          toggleExpanded={cy.stub()}
        />
      </EditorProviders>
    )

    cy.findByRole('tree')
  })

  it('renders disabled outline', function () {
    cy.mount(
      <EditorProviders>
        <OutlinePane
          isTexFile
          outline={[]}
          jumpToLine={cy.stub()}
          onToggle={cy.stub()}
          expanded
          toggleExpanded={cy.stub()}
        />
      </EditorProviders>
    )

    cy.findByRole('tree').should('not.exist')
  })

  it('expand outline and use local storage', function () {
    customLocalStorage.setItem(`file_outline.expanded.${PROJECT_ID}`, false)

    const onToggle = cy.stub()

    const Container = () => {
      const [expanded, setExpanded] = useState(false)

      return (
        <OutlinePane
          isTexFile
          outline={[{ title: 'Section', line: 1, level: 10 }]}
          jumpToLine={cy.stub()}
          onToggle={onToggle}
          expanded={expanded}
          toggleExpanded={() => {
            customLocalStorage.setItem(
              `file_outline.expanded.${PROJECT_ID}`,
              !expanded
            )
            setExpanded(!expanded)
          }}
        />
      )
    }

    cy.mount(
      <EditorProviders>
        <Container />
      </EditorProviders>
    )

    cy.findByRole('tree').should('not.exist')

    cy.findByRole('button', {
      name: 'Show File outline',
    }).click()

    cy.findByRole('tree').then(() => {
      expect(onToggle).to.be.calledTwice
      expect(
        customLocalStorage.getItem(`file_outline.expanded.${PROJECT_ID}`)
      ).to.equal(true)
    })
  })

  it('shows warning on partial result', function () {
    cy.mount(
      <EditorProviders>
        <OutlinePane
          isTexFile
          outline={[]}
          jumpToLine={cy.stub()}
          onToggle={cy.stub()}
          toggleExpanded={cy.stub()}
          isPartial
        />
      </EditorProviders>
    )

    cy.findByRole('status')
  })

  it('shows no warning on non-partial result', function () {
    cy.mount(
      <EditorProviders>
        <OutlinePane
          isTexFile
          outline={[]}
          jumpToLine={cy.stub()}
          onToggle={cy.stub()}
          toggleExpanded={cy.stub()}
        />
      </EditorProviders>
    )

    cy.findByRole('status').should('not.exist')
  })
})
