import { screen } from '@testing-library/react'
import { renderWithEditorContext } from '../../../helpers/render-with-context'
import EditorExpandButton from '../../../../../frontend/js/features/source-editor/components/editor-expand-button'

describe('<EditorExpandButton />', function () {
  it('show split screen button', function () {
    renderWithEditorContext(<EditorExpandButton />, {
      ui: { view: 'editor', pdfLayout: 'flat' },
    })
    screen.getByRole('button', { name: 'Split screen' })
  })

  it('show full screen button', function () {
    renderWithEditorContext(<EditorExpandButton />, {
      ui: { view: 'editor', pdfLayout: 'sideBySide' },
    })
    screen.getByRole('button', { name: 'Full screen' })
  })
})
