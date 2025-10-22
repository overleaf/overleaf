import { screen, within, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import type { SpellCheckLanguage } from '../../../../../types/project-settings'
import {
  EditorProviders,
  projectDefaults,
} from '../../../helpers/editor-providers'
import { SettingsModalProvider } from '@/features/ide-redesign/contexts/settings-modal-context'
import SpellCheckSetting from '@/features/ide-redesign/components/settings/editor-settings/spell-check-setting'
import userEvent from '@testing-library/user-event'

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

  it('each option is shown and can be selected', async function () {
    render(
      <EditorProviders>
        <SettingsModalProvider>
          <SpellCheckSetting />
        </SettingsModalProvider>
      </EditorProviders>
    )

    const saveSettingsMock = fetchMock.post(
      `express:/project/:projectId/settings`,
      {
        status: 200,
      },
      { delay: 0 }
    )

    const select = screen.getByLabelText('Spellcheck language')

    const optionEmpty = within(select).getByText('Off')
    expect(optionEmpty.getAttribute('value')).to.equal('')
    await userEvent.selectOptions(select, [optionEmpty])
    expect(
      saveSettingsMock.callHistory.called(
        `/project/${projectDefaults._id}/settings`,
        {
          body: { spellCheckLanguage: '' },
        }
      )
    ).to.be.true

    for (const language of languages) {
      const option = within(select).getByText(language.name)
      expect(option.getAttribute('value')).to.equal(language.code)
      await userEvent.selectOptions(select, [option])

      expect(
        saveSettingsMock.callHistory.called(
          `/project/${projectDefaults._id}/settings`,
          {
            body: { spellCheckLanguage: language.code },
          }
        )
      ).to.be.true
    }
  })
})
