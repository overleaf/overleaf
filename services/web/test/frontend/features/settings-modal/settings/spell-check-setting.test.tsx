import { screen, within, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import type { SpellCheckLanguage } from '../../../../../types/project-settings'
import { EditorProviders } from '../../../helpers/editor-providers'
import { SettingsModalProvider } from '@/features/ide-redesign/contexts/settings-modal-context'
import SpellCheckSetting from '@/features/ide-redesign/components/settings/editor-settings/spell-check-setting'

describe('<SpellCheckSetting />', function () {
  const languages: SpellCheckLanguage[] = [
    {
      name: 'Lang 1',
      code: 'lang-1',
      dic: 'lang_1',
    },
    {
      name: 'Lang 2',
      code: 'lang-2',
      dic: 'lang_2',
    },
  ]

  beforeEach(function () {
    window.metaAttributesCache.set('ol-languages', languages)
  })

  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('shows correct menu', async function () {
    render(
      <EditorProviders>
        <SettingsModalProvider>
          <SpellCheckSetting />
        </SettingsModalProvider>
      </EditorProviders>
    )

    const select = screen.getByLabelText('Spellcheck language')

    const optionEmpty = within(select).getByText('Off')
    expect(optionEmpty.getAttribute('value')).to.equal('')

    for (const language of languages) {
      const option = within(select).getByText(language.name)
      expect(option.getAttribute('value')).to.equal(language.code)
    }
  })
})
