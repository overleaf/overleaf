import '../../helpers/bootstrap-3'
import SplitMenu from '../../../../frontend/js/shared/components/split-menu'

describe('SplitMenu', function () {
  it('renders primary variant', function () {
    cy.mount(
      <SplitMenu
        bsStyle="primary"
        button={{
          text: 'Button Text',
        }}
        dropdown={{
          id: 'pdf-recompile-dropdown',
        }}
      >
        <SplitMenu.Item>Item 1</SplitMenu.Item>
        <SplitMenu.Item>Item 2</SplitMenu.Item>
        <SplitMenu.Item>Item 3</SplitMenu.Item>
      </SplitMenu>
    )

    cy.get('button.split-menu-button').contains('Button Text')
    cy.get('button.split-menu-button').should('have.class', 'btn-primary')
    cy.get('button.split-menu-dropdown-toggle').should(
      'have.class',
      'btn-primary'
    )
    cy.get('li').should('have.length', 3)
    cy.get('li').contains('Item 1')
    cy.get('li').contains('Item 2')
    cy.get('li').contains('Item 3')

    cy.get('ul.dropdown-menu').should('not.be.visible')
    cy.get('button.split-menu-dropdown-toggle').click()
    cy.get('ul.dropdown-menu').should('be.visible')
  })

  it('with custom classNames', function () {
    cy.mount(
      <SplitMenu
        bsStyle="primary"
        button={{
          text: 'Button Text',
          className: 'split-menu-class-1',
        }}
        dropdown={{
          id: 'pdf-recompile-dropdown',
          className: 'split-menu-class-2',
        }}
        dropdownToggle={{
          className: 'split-menu-class-3',
        }}
      >
        <SplitMenu.Item>Item 1</SplitMenu.Item>
      </SplitMenu>
    )

    cy.get('button.split-menu-button').should(
      'have.class',
      'split-menu-class-1'
    )
    cy.get('div.split-menu-dropdown').should('have.class', 'split-menu-class-2')
    cy.get('button.split-menu-dropdown-toggle').should(
      'have.class',
      'split-menu-class-3'
    )
  })
})
