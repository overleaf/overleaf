import { useState } from 'react'
import {
  OLModal,
  OLModalHeader,
  OLModalBody,
  OLModalFooter,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'

function Modal({ backdrop }: { backdrop?: boolean | 'static' } = {}) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <div>
      <button onClick={() => setIsModalOpen(true)}>Open modal</button>

      <OLModal
        show={isModalOpen}
        onHide={() => setIsModalOpen(false)}
        backdrop={backdrop}
      >
        <OLModalHeader>
          <OLModalTitle>This is a focus trap modal</OLModalTitle>
        </OLModalHeader>
        <OLModalBody>
          <p>This is for testing the modal behaviour</p>
          <label htmlFor="modal-input">Enter text:&nbsp;</label>
          <input id="modal-input" />
        </OLModalBody>
        <OLModalFooter>
          <button onClick={() => setIsModalOpen(false)}>Close the modal</button>
        </OLModalFooter>
      </OLModal>
    </div>
  )
}

describe('<OLModal />', function () {
  it('dismisses on single Escape key press', function () {
    cy.mount(<Modal />)
    cy.findByRole('button', { name: 'Open modal' }).should('be.visible')
    cy.findByRole('dialog').should('not.exist')
    cy.findByRole('button', { name: 'Open modal' }).click()
    cy.findByRole('dialog').should('be.visible')
    cy.findByLabelText(/enter text/i).should('be.visible')
    cy.findByRole('button', { name: 'Close dialog' }).click()
    // Modal should hide with single escape (escapeDeactivates: false means FocusTrap doesn't handle it)
    cy.findByRole('dialog').should('not.exist')
    cy.findByRole('button', { name: 'Open modal' }).should('be.visible')
  })

  it('dismisses when clicking outside of the modal (backdrop: true)', function () {
    cy.mount(<Modal />)
    cy.findByRole('button', { name: 'Open modal' }).click()
    cy.findByRole('dialog').should('be.visible')
    cy.get('body').click(0, 0)
    cy.findByRole('dialog').should('not.exist')
  })

  it('does not dismiss when clicking outside of the modal (backdrop: "static")', function () {
    cy.mount(<Modal backdrop="static" />)
    cy.findByRole('button', { name: 'Open modal' }).click()
    cy.findByRole('dialog').should('be.visible')
    cy.get('body').click(0, 0)
    cy.findByRole('dialog').should('be.visible')
  })

  it('traps focus within modal', function () {
    cy.mount(<Modal />)
    cy.findByRole('button', { name: 'Open modal' }).click()
    cy.findByRole('dialog').should('be.visible')

    cy.findByRole('button', { name: 'Close dialog' }).should('be.focused')
    cy.focused().tab()
    cy.findByLabelText(/enter text/i).should('be.focused')
    cy.focused().tab()
    cy.findByRole('button', { name: 'Close the modal' }).should('be.focused')
    cy.focused().tab()
    cy.findByRole('button', { name: 'Close dialog' }).should('be.focused')
    cy.focused().tab({ shift: true })
    cy.findByRole('button', { name: 'Close the modal' }).should('be.focused')
  })

  it('restores focus to trigger button after modal closes', function () {
    cy.mount(<Modal />)
    cy.findByRole('button', { name: 'Open modal' }).click()
    cy.findByRole('dialog').should('be.visible')
    cy.findByRole('button', { name: 'Close the modal' }).click()
    cy.findByRole('dialog').should('not.exist')
    cy.findByRole('button', { name: 'Open modal' }).should('be.focused')
    cy.focused().should('not.match', 'body')
  })

  it('closes modal when clicking close button (X)', function () {
    cy.mount(<Modal />)
    cy.findByRole('button', { name: 'Open modal' }).click()
    cy.findByRole('dialog').should('be.visible')
    cy.findByRole('button', { name: 'Close dialog' }).click()
    cy.findByRole('dialog').should('not.exist')
  })

  it('dismisses on Escape key with backdrop="static"', function () {
    cy.mount(<Modal backdrop="static" />)
    cy.findByRole('button', { name: 'Open modal' }).click()
    cy.findByRole('dialog').should('be.visible')
    cy.findByRole('button', { name: 'Close dialog' }).click()
    cy.findByRole('dialog').should('not.exist')
  })
})
