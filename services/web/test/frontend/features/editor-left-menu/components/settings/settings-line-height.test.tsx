import { screen, within, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import SettingsLineHeight from '../../../../../../frontend/js/features/editor-left-menu/components/settings/settings-line-height'
import { EditorProviders } from '../../../../helpers/editor-providers'
import { EditorLeftMenuProvider } from '@/features/editor-left-menu/components/editor-left-menu-context'

describe('<SettingsLineHeight />', function () {
  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('shows correct menu', async function () {
    render(
      <EditorProviders>
        <EditorLeftMenuProvider>
          <SettingsLineHeight />
        </EditorLeftMenuProvider>
      </EditorProviders>
    )

    const select = screen.getByLabelText('Line Height')

    const optionCompact = within(select).getByText('Compact')
    expect(optionCompact.getAttribute('value')).to.equal('compact')

    const optionNormal = within(select).getByText('Normal')
    expect(optionNormal.getAttribute('value')).to.equal('normal')

    const optionWide = within(select).getByText('Wide')
    expect(optionWide.getAttribute('value')).to.equal('wide')
  })
})
