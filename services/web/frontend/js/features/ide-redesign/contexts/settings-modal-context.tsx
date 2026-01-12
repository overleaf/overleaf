import { createContext, FC, useContext, useMemo, useState } from 'react'
import { useLayoutContext } from '@/shared/context/layout-context'
import AutoCloseBracketsSetting from '../components/settings/editor-settings/auto-close-brackets-setting'
import AutoCompleteSetting from '../components/settings/editor-settings/auto-complete-setting'
import CodeCheckSetting from '../components/settings/editor-settings/code-check-setting'
import KeybindingSetting from '../components/settings/editor-settings/keybinding-setting'
import PDFViewerSetting from '../components/settings/editor-settings/pdf-viewer-setting'
import importOverleafModules from '../../../../macros/import-overleaf-module.macro'
import SpellCheckSetting from '../components/settings/editor-settings/spell-check-setting'
import DictionarySetting from '../components/settings/editor-settings/dictionary-setting'
import { useTranslation } from 'react-i18next'
import BreadcrumbsSetting from '../components/settings/editor-settings/breadcrumbs-setting'
import MathPreviewSetting from '../components/settings/editor-settings/math-preview-setting'
import RootDocumentSetting from '../components/settings/compiler-settings/root-document-setting'
import CompilerSetting from '../components/settings/compiler-settings/compiler-setting'
import ImageNameSetting from '../components/settings/compiler-settings/image-name-setting'
import DraftSetting from '../components/settings/compiler-settings/draft-setting'
import StopOnFirstErrorSetting from '../components/settings/compiler-settings/stop-on-first-error-setting'
import AutoCompileSetting from '../components/settings/compiler-settings/auto-compile-setting'
import OverallThemeSetting from '../components/settings/appearance-settings/overall-theme-setting'
import EditorThemeSetting from '../components/settings/appearance-settings/editor-theme-setting'
import FontSizeSetting from '../components/settings/appearance-settings/font-size-setting'
import LineHeightSetting from '../components/settings/appearance-settings/line-height-setting'
import FontFamilySetting from '../components/settings/appearance-settings/font-family-setting'
import { AvailableUnfilledIcon } from '@/shared/components/material-icon'
import { EditorLeftMenuProvider } from '@/features/editor-left-menu/components/editor-left-menu-context'
import NewEditorSetting from '../components/settings/editor-settings/new-editor-setting'
import DarkModePdfSetting from '../components/settings/appearance-settings/dark-mode-pdf-setting'
import { useProjectSettingsContext } from '@/features/editor-left-menu/context/project-settings-context'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import ProjectNotificationsSetting from '../components/settings/editor-settings/project-notifications-setting'

const [referenceSearchSettingModule] = importOverleafModules(
  'referenceSearchSetting'
)
const ReferenceSearchSetting = referenceSearchSettingModule?.import.default

type Setting = {
  key: string
  component: React.ReactNode
  hidden?: boolean
}

type SettingsSection = {
  title?: string
  key: string
  settings: Setting[]
}

export type SettingsTab = {
  key: string
  icon: AvailableUnfilledIcon
  sections: SettingsSection[]
  title: string
  hidden?: boolean
}

type SettingsLink = {
  key: string
  icon: AvailableUnfilledIcon
  href: string
  title: string
  hidden?: boolean
}

export type SettingsEntry = SettingsLink | SettingsTab

type SettingsModalState = {
  show: boolean
  setShow: (shown: boolean) => void
  activeTab: string | null | undefined
  setActiveTab: (tab: string | null | undefined) => void
  settingsTabs: SettingsEntry[]
  settingToTabMap: Map<string, string>
}

export const SettingsModalContext = createContext<
  SettingsModalState | undefined
>(undefined)

export const SettingsModalProvider: FC<React.PropsWithChildren> = ({
  children,
}) => {
  const { t } = useTranslation()
  const { overallTheme } = useProjectSettingsContext()

  // TODO ide-redesign-cleanup: Rename this field and move it directly into this context
  const { leftMenuShown, setLeftMenuShown } = useLayoutContext()

  const hasEmailNotifications = useFeatureFlag('email-notifications')
  const noNewEditorOptOut = useFeatureFlag('editor-redesign-no-opt-out')

  const allSettingsTabs: SettingsEntry[] = useMemo(
    () => [
      {
        key: 'editor',
        title: t('editor'),
        icon: 'code',
        sections: [
          {
            key: 'general',
            settings: [
              {
                key: 'autoComplete',
                component: <AutoCompleteSetting />,
              },
              {
                key: 'autoPairDelimiters',
                component: <AutoCloseBracketsSetting />,
              },
              {
                key: 'syntaxValidation',
                component: <CodeCheckSetting />,
              },
              {
                key: 'mode',
                component: <KeybindingSetting />,
              },
              {
                key: 'pdfViewer',
                component: <PDFViewerSetting />,
              },
              {
                key: 'write-and-cite-settings',
                component: <ReferenceSearchSetting />,
                hidden: !ReferenceSearchSetting,
              },
            ],
          },
          {
            key: 'spellcheck',
            title: t('spellcheck'),
            settings: [
              {
                key: 'spellCheckLanguage',
                component: <SpellCheckSetting />,
              },
              {
                key: 'dictionary-settings',
                component: <DictionarySetting />,
              },
            ],
          },
          {
            key: 'tools',
            title: t('tools'),
            settings: [
              {
                key: 'breadcrumbs-setting',
                component: <BreadcrumbsSetting />,
              },
              {
                key: 'mathPreview',
                component: <MathPreviewSetting />,
              },
            ],
          },
        ],
      },
      {
        key: 'compiler',
        title: t('compiler'),
        icon: 'picture_as_pdf',
        sections: [
          {
            key: 'general',
            settings: [
              {
                key: 'rootDocId',
                component: <RootDocumentSetting />,
              },
              {
                key: 'compiler',
                component: <CompilerSetting />,
              },
              {
                key: 'imageName',
                component: <ImageNameSetting />,
              },
              {
                key: 'draft',
                component: <DraftSetting />,
              },
              {
                key: 'stopOnFirstError',
                component: <StopOnFirstErrorSetting />,
              },
              {
                key: 'autoCompile',
                component: <AutoCompileSetting />,
              },
            ],
          },
        ],
      },
      {
        key: 'appearance',
        title: t('appearance'),
        icon: 'brush',
        sections: [
          {
            key: 'general',
            settings: [
              {
                key: 'overallTheme',
                component: <OverallThemeSetting />,
              },
              {
                key: 'editorTheme',
                component: <EditorThemeSetting />,
              },
              {
                key: 'pdfDarkMode',
                component: <DarkModePdfSetting />,
                hidden: overallTheme === 'light-',
              },
              {
                key: 'fontSize',
                component: <FontSizeSetting />,
              },
              {
                key: 'fontFamily',
                component: <FontFamilySetting />,
              },
              {
                key: 'lineHeight',
                component: <LineHeightSetting />,
              },
              {
                key: 'newEditor',
                component: <NewEditorSetting />,
                hidden: noNewEditorOptOut,
              },
            ],
          },
        ],
      },

      {
        key: 'project_notifications',
        title: t('project_notifications'),
        icon: 'notifications' as const,
        sections: [
          {
            key: 'general',
            settings: [
              {
                key: 'projectNotifications',
                component: <ProjectNotificationsSetting />,
              },
            ],
          },
        ],
        hidden: !hasEmailNotifications,
      },

      {
        key: 'account_settings',
        title: t('account_settings'),
        icon: 'settings',
        href: '/user/settings',
      },
      {
        key: 'subscription',
        title: t('subscription'),
        icon: 'account_balance',
        href: '/user/subscription',
      },
    ],
    [t, overallTheme, hasEmailNotifications, noNewEditorOptOut]
  )

  const settingsTabs = useMemo(
    () => allSettingsTabs.filter(tab => !tab.hidden),
    [allSettingsTabs]
  )

  const settingToTabMap = useMemo(() => {
    const map = new Map<string, string>()
    settingsTabs
      .filter(t => 'sections' in t)
      .forEach(tab => {
        tab.sections.forEach(section => {
          section.settings.forEach(setting => {
            map.set(setting.key, tab.key)
          })
        })
      })
    return map
  }, [settingsTabs])

  const [activeTab, setActiveTab] = useState<string | null | undefined>(
    settingsTabs[0]?.key
  )

  const value = useMemo(
    () => ({
      show: leftMenuShown,
      setShow: setLeftMenuShown,
      activeTab,
      setActiveTab,
      settingsTabs,
      settingToTabMap,
    }),
    [
      leftMenuShown,
      setLeftMenuShown,
      activeTab,
      setActiveTab,
      settingsTabs,
      settingToTabMap,
    ]
  )

  return (
    // TODO ide-redesign-cleanup: Merge <EditorLeftMenuProvider> into <SettingsModalProvider>
    <EditorLeftMenuProvider>
      <SettingsModalContext.Provider value={value}>
        {children}
      </SettingsModalContext.Provider>
    </EditorLeftMenuProvider>
  )
}

export const useSettingsModalContext = () => {
  const value = useContext(SettingsModalContext)

  if (!value) {
    throw new Error(
      `useSettingsModalContext is only available inside SettingsModalProvider`
    )
  }

  return value
}
