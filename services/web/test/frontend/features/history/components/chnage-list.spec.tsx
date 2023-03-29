import { useState } from 'react'
import ToggleSwitch from '../../../../../frontend/js/features/history/components/change-list/toggle-switch'

describe('change list', function () {
  describe('toggle switch', function () {
    it('renders switch buttons', function () {
      cy.mount(<ToggleSwitch labelsOnly={false} setLabelsOnly={() => {}} />)

      cy.findByLabelText(/all history/i)
      cy.findByLabelText(/labels/i)
    })

    it('toggles "all history" and "labels" buttons', function () {
      function ToggleSwitchWrapped({ labelsOnly }: { labelsOnly: boolean }) {
        const [labelsOnlyLocal, setLabelsOnlyLocal] = useState(labelsOnly)
        return (
          <ToggleSwitch
            labelsOnly={labelsOnlyLocal}
            setLabelsOnly={setLabelsOnlyLocal}
          />
        )
      }

      cy.mount(<ToggleSwitchWrapped labelsOnly={false} />)

      cy.findByLabelText(/all history/i).as('all-history')
      cy.findByLabelText(/labels/i).as('labels')
      cy.get('@all-history').should('be.checked')
      cy.get('@labels').should('not.be.checked')
      cy.get('@labels').click({ force: true })
      cy.get('@all-history').should('not.be.checked')
      cy.get('@labels').should('be.checked')
    })
  })
})
