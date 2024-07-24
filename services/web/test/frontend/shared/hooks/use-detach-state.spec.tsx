import '../../helpers/bootstrap-3'
import { FC } from 'react'
import useDetachState from '../../../../frontend/js/shared/hooks/use-detach-state'
import { EditorProviders } from '../../helpers/editor-providers'
import { detachChannel, testDetachChannel } from '../../helpers/detach-channel'

const DetachStateTest: FC<{
  stateKey: string
  defaultValue: any
  senderRole?: string
  targetRole?: string
  handleClick: (setValue: (value: any) => void) => void
}> = ({ stateKey, defaultValue, handleClick, senderRole, targetRole }) => {
  const [value, setValue] = useDetachState(
    stateKey,
    defaultValue,
    senderRole,
    targetRole
  )

  return (
    <div>
      <div id="value">{value}</div>
      <button id="setValue" onClick={() => handleClick(setValue)}>
        set value
      </button>
    </div>
  )
}

describe('useDetachState', function () {
  it('create and update state', function () {
    cy.mount(
      <EditorProviders>
        <DetachStateTest
          stateKey="some-key"
          defaultValue="foobar"
          handleClick={setValue => {
            setValue('barbaz')
          }}
        />
      </EditorProviders>
    )

    cy.get('#value').should('have.text', 'foobar')
    cy.get('#setValue').click()
    cy.get('#value').should('have.text', 'barbaz')
  })

  it('broadcast message as sender', function () {
    window.metaAttributesCache.set('ol-detachRole', 'detacher')

    cy.mount(
      <EditorProviders>
        <DetachStateTest
          stateKey="some-key"
          defaultValue={null}
          senderRole="detacher"
          targetRole="detached"
          handleClick={setValue => {
            setValue('barbaz1')
          }}
        />
      </EditorProviders>
    )

    cy.spy(detachChannel, 'postMessage').as('postDetachMessage')
    cy.get('#setValue').click()
    cy.get('@postDetachMessage').should('have.been.calledWith', {
      role: 'detacher',
      event: 'state-some-key',
      data: { value: 'barbaz1' },
    })
  })

  it('receive message as target', function () {
    window.metaAttributesCache.set('ol-detachRole', 'detached')

    cy.mount(
      <EditorProviders>
        <DetachStateTest
          stateKey="some-key"
          defaultValue={null}
          senderRole="detacher"
          targetRole="detached"
          handleClick={() => {}}
        />
      </EditorProviders>
    )

    cy.wrap(null).then(() => {
      testDetachChannel.postMessage({
        role: 'detached',
        event: 'state-some-key',
        data: { value: 'barbaz2' },
      })
    })

    cy.get('#value').should('have.text', 'barbaz2')
  })
})
