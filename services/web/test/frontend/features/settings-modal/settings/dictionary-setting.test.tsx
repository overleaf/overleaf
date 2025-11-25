import { fireEvent, screen, within, render } from '@testing-library/react'
import { expect } from 'chai'
import { SettingsModalProvider } from '@/features/ide-redesign/contexts/settings-modal-context'
import { EditorProviders } from '../../../helpers/editor-providers'
import DictionarySetting from '@/features/ide-redesign/components/settings/editor-settings/dictionary-setting'
import RailModals from '@/features/ide-redesign/components/rail/rail-modals'

describe('<DictionarySetting />', function () {
  it('open dictionary modal', function () {
    render(
      <EditorProviders>
        <SettingsModalProvider>
          <DictionarySetting />
          <RailModals />
        </SettingsModalProvider>
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
