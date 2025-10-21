import { screen, within, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { EditorProviders } from '../../../helpers/editor-providers'
import { SettingsModalProvider } from '@/features/ide-redesign/contexts/settings-modal-context'
import PDFViewerSetting from '@/features/ide-redesign/components/settings/editor-settings/pdf-viewer-setting'

describe('<PDFViewerSetting />', function () {
  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('shows correct menu', async function () {
    render(
      <EditorProviders>
        <SettingsModalProvider>
          <PDFViewerSetting />
        </SettingsModalProvider>
      </EditorProviders>
    )

    const select = screen.getByLabelText('PDF Viewer')

    const optionOverleaf = within(select).getByText('Overleaf')
    expect(optionOverleaf.getAttribute('value')).to.equal('pdfjs')

    const optionBrowser = within(select).getByText('Browser')
    expect(optionBrowser.getAttribute('value')).to.equal('native')
  })
})
