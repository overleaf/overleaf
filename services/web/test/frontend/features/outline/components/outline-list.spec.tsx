import '../../../helpers/bootstrap-3'
import OutlineList from '../../../../../frontend/js/features/outline/components/outline-list'

describe('<OutlineList />', function () {
  it('renders items', function () {
    cy.mount(
      <OutlineList
        // @ts-ignore
        outline={[
          { title: 'Section 1', line: 1, level: 10 },
          { title: 'Section 2', line: 2, level: 10 },
        ]}
        isRoot
        jumpToLine={cy.stub()}
      />
    )

    cy.findByRole('treeitem', { name: 'Section 1' })
    cy.findByRole('treeitem', { name: 'Section 2' })
  })

  it('renders as root', function () {
    cy.mount(
      <OutlineList
        // @ts-ignore
        outline={[{ title: 'Section', line: 1, level: 10 }]}
        isRoot
        jumpToLine={cy.stub()}
      />
    )

    cy.findByRole('tree')
  })

  it('renders as non-root', function () {
    cy.mount(
      <OutlineList
        // @ts-ignore
        outline={[{ title: 'Section', line: 1, level: 10 }]}
        jumpToLine={cy.stub()}
      />
    )

    cy.findByRole('group')
  })
})
