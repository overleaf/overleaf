import OutlineItem from '../../../../../frontend/js/features/outline/components/outline-item'

describe('<OutlineItem />', function () {
  it('renders basic item', function () {
    cy.mount(
      <OutlineItem
        // @ts-ignore
        outlineItem={{
          title: 'Test Title',
          line: 1,
        }}
        jumpToLine={cy.stub()}
      />
    )

    cy.findByRole('treeitem', { current: false })
    cy.findByRole('button', { name: 'Test Title' })
    cy.findByRole('button', { name: 'Collapse' }).should('not.exist')
  })

  it('collapses and expands', function () {
    cy.mount(
      <OutlineItem
        // @ts-ignore
        outlineItem={{
          title: 'Parent',
          line: 1,
          children: [{ title: 'Child', line: 2 }],
        }}
        jumpToLine={cy.stub()}
      />
    )

    cy.findByRole('button', { name: 'Child' })
    cy.findByRole('button', { name: 'Collapse' }).click()
    cy.findByRole('button', { name: 'Expand' })
    cy.findByRole('button', { name: 'Child' }).should('not.exist')
  })

  it('highlights', function () {
    cy.mount(
      <OutlineItem
        // @ts-ignore
        outlineItem={{
          title: 'Parent',
          line: 1,
        }}
        jumpToLine={cy.stub()}
        highlightedLine={1}
        matchesHighlightedLine
      />
    )

    cy.findByRole('treeitem', { current: true })
  })

  it('highlights when has collapsed highlighted child', function () {
    cy.mount(
      <OutlineItem
        // @ts-ignore
        outlineItem={{
          title: 'Parent',
          line: 1,
          children: [{ title: 'Child', line: 2 }],
        }}
        jumpToLine={cy.stub()}
        highlightedLine={2}
        containsHighlightedLine
      />
    )

    cy.findByRole('treeitem', { name: 'Parent', current: false })
    cy.findByRole('treeitem', { name: 'Child', current: true })
    cy.findByRole('button', { name: 'Collapse' }).click()
    cy.findByRole('treeitem', { name: 'Parent', current: true })
  })

  it('click and double-click jump to location', function () {
    cy.mount(
      <OutlineItem
        // @ts-ignore
        outlineItem={{
          title: 'Parent',
          line: 1,
        }}
        jumpToLine={cy.stub().as('jumpToLine')}
      />
    )

    cy.findByRole('button', { name: 'Parent' }).click()
    cy.get('@jumpToLine').should('have.been.calledOnceWith', 1, false)

    cy.findByRole('button', { name: 'Parent' }).dblclick()
    cy.get('@jumpToLine').should('have.been.calledThrice')
    cy.get('@jumpToLine').should('have.been.calledWith', 1, true)
  })
})
