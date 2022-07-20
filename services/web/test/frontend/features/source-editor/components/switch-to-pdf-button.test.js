import { screen } from '@testing-library/react'
import { expect } from 'chai'
import { renderWithEditorContext } from '../../../helpers/render-with-context'
import SwitchToPDFButton from '../../../../../frontend/js/features/source-editor/components/switch-to-pdf-button'

describe('<SwitchToPDFButton />', function () {
  beforeEach(function () {
    window.metaAttributesCache = new Map()
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
  })

  it('shows button in full screen layout', function () {
    renderWithEditorContext(<SwitchToPDFButton />, {
      ui: { view: 'editor', pdfLayout: 'flat' },
    })
    screen.getByRole('button', { name: 'Switch to PDF' })
  })

  it('does not show button in split screen layout', function () {
    renderWithEditorContext(<SwitchToPDFButton />, {
      ui: { view: 'editor', pdfLayout: 'sideBySide' },
    })
    expect(screen.queryByRole('button', { name: 'Full screen' })).to.not.exist
  })

  it('does not show button when detached', function () {
    window.metaAttributesCache.set('ol-detachRole', 'detacher')
    renderWithEditorContext(<SwitchToPDFButton />, {
      ui: { view: 'editor', pdfLayout: 'flat' },
    })
    expect(screen.queryByRole('button', { name: 'Full screen' })).to.not.exist
  })
})
