import '../../../helpers/bootstrap-3'
import SwitchToPDFButton from '@/features/source-editor/components/switch-to-pdf-button'
import { EditorProviders } from '../../../helpers/editor-providers'

describe('<SwitchToPDFButton />', function () {
  it('shows button in full screen editor layout', function () {
    cy.mount(
      <EditorProviders
        ui={{ view: 'editor', pdfLayout: 'flat', chatOpen: false }}
      >
        <SwitchToPDFButton />
      </EditorProviders>
    )

    cy.findByRole('button', { name: 'Switch to PDF' })
  })

  it('does not show button in split screen layout', function () {
    cy.mount(
      <EditorProviders
        ui={{ view: 'editor', pdfLayout: 'sideBySide', chatOpen: false }}
      >
        <SwitchToPDFButton />
      </EditorProviders>
    )

    cy.findByRole('button', { name: 'Switch to PDF' }).should('not.exist')
  })

  it('does not show button when detached', function () {
    window.metaAttributesCache.set('ol-detachRole', 'detacher')

    cy.mount(
      <EditorProviders
        ui={{ view: 'editor', pdfLayout: 'flat', chatOpen: false }}
      >
        <SwitchToPDFButton />
      </EditorProviders>
    )

    cy.findByRole('button', { name: 'Switch to PDF' }).should('not.exist')
  })
})
