import '../../../helpers/bootstrap-3'
import { EditorProviders } from '../../../helpers/editor-providers'
import SwitchToEditorButton from '@/features/pdf-preview/components/switch-to-editor-button'

describe('<SwitchToEditorButton />', function () {
  it('shows button in full screen pdf layout', function () {
    cy.mount(
      <EditorProviders ui={{ view: 'pdf', pdfLayout: 'flat', chatOpen: false }}>
        <SwitchToEditorButton />
      </EditorProviders>
    )

    cy.findByRole('button', { name: 'Switch to editor' })
  })

  it('does not show button in split screen layout', function () {
    cy.mount(
      <EditorProviders
        ui={{ view: 'pdf', pdfLayout: 'sideBySide', chatOpen: false }}
      >
        <SwitchToEditorButton />
      </EditorProviders>
    )

    cy.findByRole('button', { name: 'Switch to editor' }).should('not.exist')
  })

  it('does not show button when detached', function () {
    window.metaAttributesCache.set('ol-detachRole', 'detacher')

    cy.mount(
      <EditorProviders ui={{ view: 'pdf', pdfLayout: 'flat', chatOpen: false }}>
        <SwitchToEditorButton />
      </EditorProviders>
    )

    cy.findByRole('button', { name: 'Switch to editor' }).should('not.exist')
  })
})
