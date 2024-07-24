import '../../helpers/bootstrap-3'
import { Modal } from 'react-bootstrap'
import AccessibleModal from '../../../../frontend/js/shared/components/accessible-modal'

describe('AccessibleModal', function () {
  it('renders a visible modal', function () {
    const handleHide = cy.stub()

    cy.mount(
      <AccessibleModal onHide={handleHide} show>
        <Modal.Header closeButton>
          <Modal.Title>Test</Modal.Title>
        </Modal.Header>

        <Modal.Body>Some content</Modal.Body>
      </AccessibleModal>
    )

    cy.findByRole('dialog').should('have.length', 1)
  })

  it('does not render a hidden modal', function () {
    const handleHide = cy.stub()

    cy.mount(
      <AccessibleModal onHide={handleHide}>
        <Modal.Header closeButton>
          <Modal.Title>Test</Modal.Title>
        </Modal.Header>

        <Modal.Body>Some content</Modal.Body>
      </AccessibleModal>
    )

    cy.findByRole('dialog', { hidden: true }).should('have.length', 0)
  })
})
