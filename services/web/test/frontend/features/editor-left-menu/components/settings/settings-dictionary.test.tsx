import { fireEvent, screen, within, render } from '@testing-library/react'
import { expect } from 'chai'
import SettingsDictionary from '../../../../../../frontend/js/features/editor-left-menu/components/settings/settings-dictionary'
import { EditorLeftMenuProvider } from '@/features/editor-left-menu/components/editor-left-menu-context'
import { EditorProviders } from '../../../../helpers/editor-providers'

describe('<SettingsDictionary />', function () {
  it('open dictionary modal', function () {
    render(
      <EditorProviders>
        <EditorLeftMenuProvider>
          <SettingsDictionary />
        </EditorLeftMenuProvider>
      </EditorProviders>
    )

    screen.getByText('Dictionary')

    const button = screen.getByText('Edit')
    fireEvent.click(button)

    const modal = screen.getByTestId('dictionary-modal')

    within(modal).getByRole('heading', { name: 'Edit Dictionary' })
    within(modal).getByText('Your custom dictionary is empty.')

    const closeButton = within(modal).getByRole('button', {
      name: 'Close dialog',
    })
    fireEvent.click(closeButton)
    expect(screen.getByTestId('dictionary-modal')).to.not.be.null
  })
})
