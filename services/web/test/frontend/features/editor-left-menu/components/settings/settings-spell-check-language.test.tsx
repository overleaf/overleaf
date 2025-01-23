import { screen, within, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import SettingsSpellCheckLanguage from '../../../../../../frontend/js/features/editor-left-menu/components/settings/settings-spell-check-language'
import type { SpellCheckLanguage } from '../../../../../../types/project-settings'
import { EditorProviders } from '../../../../helpers/editor-providers'
import { EditorLeftMenuProvider } from '@/features/editor-left-menu/components/editor-left-menu-context'

describe('<SettingsSpellCheckLanguage />', function () {
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
    fetchMock.reset()
  })

  it('shows correct menu', async function () {
    render(
      <EditorProviders>
        <EditorLeftMenuProvider>
          <SettingsSpellCheckLanguage />
        </EditorLeftMenuProvider>
      </EditorProviders>
    )

    const select = screen.getByLabelText('Spell check')

    const optionEmpty = within(select).getByText('Off')
    expect(optionEmpty.getAttribute('value')).to.equal('')

    for (const language of languages) {
      const option = within(select).getByText(language.name)
      expect(option.getAttribute('value')).to.equal(language.code)
    }
  })
})
