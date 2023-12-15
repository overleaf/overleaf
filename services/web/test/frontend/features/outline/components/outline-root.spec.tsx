import OutlineRoot from '../../../../../frontend/js/features/outline/components/outline-root'

describe('<OutlineRoot />', function () {
  it('renders outline', function () {
    cy.mount(
      <OutlineRoot
        outline={[{ title: 'Section', line: 1, level: 10 }]}
        jumpToLine={cy.stub()}
      />
    )

    cy.findByRole('tree')
    cy.findByRole('link').should('not.exist')
  })

  it('renders placeholder', function () {
    cy.mount(<OutlineRoot outline={[]} jumpToLine={cy.stub()} />)

    cy.findByRole('tree').should('not.exist')
    cy.findByRole('link')
  })
})
