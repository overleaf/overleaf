import { screen, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { EditorProviders } from '../../helpers/editor-providers'
import SettingsModal from '@/features/ide-redesign/components/settings/settings-modal'
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
    'Spellcheck language',
    'Dictionary',
    'Breadcrumbs',
    'Equation preview',
  ],
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
      path: 'https://overleaf.com/overalltheme-1.css',
    },
    {
      name: 'Overall Theme 2',
      val: 'light-',
      path: 'https://overleaf.com/overalltheme-2.css',
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
})
