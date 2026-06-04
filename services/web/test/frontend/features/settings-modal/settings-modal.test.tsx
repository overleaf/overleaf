import { screen, render, waitFor } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { EditorProviders } from '../../helpers/editor-providers'
import SettingsModal from '@/features/settings/components/settings-modal'
import { Folder } from '@ol-types/folder'
import { ImageName, OverallThemeMeta } from '@ol-types/project-settings'

const selectTab = async (tabName: string) => {
  const tab = screen.getByRole('tab', { name: tabName })
  expect(tab).to.exist
  tab.click()
}

const assertSettingIsVisible = (settingName: string) => {
  expect(screen.getByLabelText(settingName)).to.exist
}

const TAB_SETTINGS = {
  Editor: [
    'Auto-complete',
    'Auto-close brackets',
    'Code check',
    'Keybindings',
    'PDF Viewer',
    'Reference search',
    'Breadcrumbs',
    'Equation preview',
  ],
  'Spelling and language': ['Spellcheck language', 'Dictionary'],
  Compiler: [
    'Main document',
    'Compiler',
    'TeX Live version',
    'Compile mode',
    'Stop on first error',
    'Autocompile',
  ],
  Appearance: [
    'Overall theme',
    'Editor theme',
    'Editor font size',
    'Editor font family',
    'Editor line height',
  ],
}

describe('<SettingsModal />', function () {
  const overallThemes: OverallThemeMeta[] = [
    {
      name: 'Overall Theme 1',
      val: '',
    },
    {
      name: 'Overall Theme 2',
      val: 'light-',
    },
  ]

  const editorThemes = [
    { name: 'editortheme-1', dark: false },
    { name: 'editortheme-2', dark: false },
    { name: 'editortheme-3', dark: false },
  ]
  const legacyEditorThemes = [
    { name: 'legacytheme-1', dark: false },
    { name: 'legacytheme-2', dark: false },
    { name: 'legacytheme-3', dark: false },
  ]

  const imageNames: ImageName[] = [
    {
      imageDesc: 'Image 1',
      imageName: 'img-1',
      allowed: true,
    },
    {
      imageDesc: 'Image 2',
      imageName: 'img-2',
      allowed: true,
    },
  ]

  const rootFolder: Folder = {
    _id: 'root-folder-id',
    name: 'rootFolder',
    docs: [
      {
        _id: '123abc',
        name: 'main.tex',
      },
    ],
    fileRefs: [],
    folders: [],
  }

  let originalSettings: typeof window.metaAttributesCache

  beforeEach(function () {
    originalSettings = window.metaAttributesCache.get('ol-ExposedSettings')
    window.metaAttributesCache.set('ol-ExposedSettings', {
      validRootDocExtensions: ['tex'],
      ieeeBrandId: 1234,
    })
    window.metaAttributesCache.set('ol-imageNames', imageNames)
    window.metaAttributesCache.set('ol-overallThemes', overallThemes)
    window.metaAttributesCache.set('ol-editorThemes', editorThemes)
    window.metaAttributesCache.set('ol-legacyEditorThemes', legacyEditorThemes)
  })

  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
    window.metaAttributesCache.set('ol-ExposedSettings', originalSettings)
  })

  it('Shows all settings options', async function () {
    render(
      <EditorProviders
        rootFolder={[rootFolder as any]}
        layoutContext={{ leftMenuShown: true }}
      >
        <SettingsModal />
      </EditorProviders>
    )

    Object.entries(TAB_SETTINGS).forEach(([tabName, settings]) => {
      selectTab(tabName)
      settings.forEach(setting => assertSettingIsVisible(setting))
    })
  })

  describe('when a user has Writefull enabled', function () {
    beforeEach(function () {
      window.metaAttributesCache.set('ol-writefullEnabled', true)
      window.metaAttributesCache.set('ol-showAiFeatures', true)
    })

    afterEach(function () {
      window.metaAttributesCache.delete('ol-writefullEnabled')
      window.metaAttributesCache.delete('ol-showAiFeatures')
    })

    it('shows the AI assistance section in the Editor tab', async function () {
      render(
        <EditorProviders
          rootFolder={[rootFolder as any]}
          layoutContext={{ leftMenuShown: true }}
        >
          <SettingsModal />
        </EditorProviders>
      )

      selectTab('Editor')
      await waitFor(() => expect(screen.getByText('AI assistance')).to.exist)
    })

    it('shows the Language Suggestions section in the Spelling and language tab', async function () {
      render(
        <EditorProviders
          rootFolder={[rootFolder as any]}
          layoutContext={{ leftMenuShown: true }}
        >
          <SettingsModal />
        </EditorProviders>
      )

      selectTab('Spelling and language')
      await waitFor(
        () => expect(screen.getByText('Language suggestions')).to.exist
      )
    })
  })

  describe('when a user does not have Writefull enabled', function () {
    afterEach(function () {
      window.metaAttributesCache.delete('ol-writefullEnabled')
      window.metaAttributesCache.delete('ol-showAiFeatures')
      window.metaAttributesCache.delete('ol-cannot-use-ai')
    })

    it('does not show the AI assistance section when ol-writefullEnabled is false', async function () {
      window.metaAttributesCache.set('ol-writefullEnabled', false)
      window.metaAttributesCache.set('ol-showAiFeatures', true)
      render(
        <EditorProviders
          rootFolder={[rootFolder as any]}
          layoutContext={{ leftMenuShown: true }}
        >
          <SettingsModal />
        </EditorProviders>
      )

      selectTab('Editor')
      await waitFor(
        () => expect(screen.getByLabelText('Auto-complete')).to.exist
      )
      expect(screen.queryByText('AI assistance')).to.be.null
    })

    it('does not show the Language Suggestions section when ol-writefullEnabled is false', async function () {
      window.metaAttributesCache.set('ol-writefullEnabled', false)
      window.metaAttributesCache.set('ol-showAiFeatures', true)
      render(
        <EditorProviders
          rootFolder={[rootFolder as any]}
          layoutContext={{ leftMenuShown: true }}
        >
          <SettingsModal />
        </EditorProviders>
      )

      selectTab('Spelling and language')
      await waitFor(
        () => expect(screen.getByLabelText('Spellcheck language')).to.exist
      )
      expect(screen.queryByText('Language suggestions')).to.be.null
    })

    it('does not show the AI assistance section when ol-showAiFeatures is false', async function () {
      window.metaAttributesCache.set('ol-writefullEnabled', true)
      window.metaAttributesCache.set('ol-showAiFeatures', false)
      render(
        <EditorProviders
          rootFolder={[rootFolder as any]}
          layoutContext={{ leftMenuShown: true }}
        >
          <SettingsModal />
        </EditorProviders>
      )

      selectTab('Editor')
      await waitFor(
        () => expect(screen.getByLabelText('Auto-complete')).to.exist
      )
      expect(screen.queryByText('AI assistance')).to.be.null
    })

    it('does not show the AI assistance section when ol-cannot-use-ai is true', async function () {
      window.metaAttributesCache.set('ol-writefullEnabled', true)
      window.metaAttributesCache.set('ol-showAiFeatures', true)
      window.metaAttributesCache.set('ol-cannot-use-ai', true)
      render(
        <EditorProviders
          rootFolder={[rootFolder as any]}
          layoutContext={{ leftMenuShown: true }}
        >
          <SettingsModal />
        </EditorProviders>
      )

      selectTab('Editor')
      await waitFor(
        () => expect(screen.getByLabelText('Auto-complete')).to.exist
      )
      expect(screen.queryByText('AI assistance')).to.be.null
    })
  })

  describe('when open=project-notifications query param is present', function () {
    beforeEach(function () {
      window.metaAttributesCache.set('ol-splitTestVariants', {
        'email-notifications': 'enabled',
      })
      fetchMock.get(/\/notifications\/preferences\/project\//, {
        trackedChangesOnOwnProject: false,
        trackedChangesOnInvitedProject: false,
        commentOnOwnProject: false,
        commentOnInvitedProject: false,
        repliesOnOwnProject: false,
        repliesOnInvitedProject: false,
        repliesOnAuthoredThread: false,
        repliesOnParticipatingThread: false,
      })
      window.history.pushState({}, '', '?open=project-notifications')
    })

    afterEach(function () {
      window.history.pushState({}, '', window.location.pathname)
      window.metaAttributesCache.delete('ol-splitTestVariants')
    })

    it('opens the modal and selects the Project notifications tab', async function () {
      render(
        <EditorProviders rootFolder={[rootFolder as any]}>
          <SettingsModal />
        </EditorProviders>
      )

      await waitFor(
        () =>
          expect(
            screen.getByRole('tab', {
              name: /Project notifications/,
              selected: true,
            })
          ).to.exist
      )
    })

    it('removes the open param from the URL', async function () {
      render(
        <EditorProviders rootFolder={[rootFolder as any]}>
          <SettingsModal />
        </EditorProviders>
      )

      await waitFor(() => {
        expect(window.location.search).to.not.include(
          'open=project-notifications'
        )
      })
    })
  })
})
