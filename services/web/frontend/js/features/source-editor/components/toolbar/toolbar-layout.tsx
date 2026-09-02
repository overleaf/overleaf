import { ReactNode, ElementType } from 'react'
import '../../../../../stylesheets/components/editor-toolbar.scss'
import { ToolbarButton } from './toolbar-button'
import { undo, redo } from '@codemirror/commands'
import { useTranslation } from 'react-i18next'
import { isMac } from '@/shared/utils/os'
import { useCodeMirrorStateContext } from '@/features/source-editor/components/codemirror-context'
import { useProjectContext } from '@/shared/context/project-context'
import EditorSwitch from '@/features/source-editor/components/editor-switch'
import ReviewModeSwitcher from '@/features/review-panel/components/review-mode-switcher'
import { ToggleSearchButton } from './toggle-search-button'
import SwitchToPDFButton from '../switch-to-pdf-button'
import importOverleafModules from '../../../../../macros/import-overleaf-module.macro'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import useIsNetworkStalled from '@/features/ide-react/hooks/use-is-network-stalled'
import DownloadFileButton from './download-file-button'

type ToolbarLayoutProps = {
  children: ReactNode
  className?: string
}

type ToolbarLayoutLeftProps = {
  children?: ReactNode
  canEdit?: boolean
  showActions?: boolean
}

type ToolbarLayoutRightProps = {
  canSearchInFile?: boolean
  canUseWritefull?: boolean
  children?: ReactNode
}

const sourceEditorToolbarEndButtons = importOverleafModules(
  'sourceEditorToolbarEndButtons'
) as { import: { default: ElementType }; path: string }[]

const sourceEditorToolbarStartButtons = importOverleafModules(
  'sourceEditorToolbarStartButtons'
) as { import: { default: ElementType }; path: string }[]

function Left({ children, canEdit, showActions }: ToolbarLayoutLeftProps) {
  const { t } = useTranslation()
  return (
    <div className="ol-toolbar-layout-left">
      {showActions &&
        sourceEditorToolbarStartButtons.map(
          ({ import: { default: Component }, path }) => <Component key={path} />
        )}
      {canEdit && (
        <div
          className="ol-editor-toolbar-button-group"
          aria-label={t('toolbar_undo_redo_actions')}
        >
          <ToolbarButton
            id="toolbar-undo"
            label={t('toolbar_undo')}
            command={undo}
            icon="undo"
            shortcut={isMac ? '⌘Z' : 'Ctrl+Z'}
          />
          <ToolbarButton
            id="toolbar-redo"
            label={t('toolbar_redo')}
            command={redo}
            icon="redo"
            shortcut={isMac ? '⇧⌘Z' : 'Ctrl+Y'}
          />
        </div>
      )}
      {children}
    </div>
  )
}

function Right({
  canSearchInFile,
  canUseWritefull = true,
  children,
}: ToolbarLayoutRightProps) {
  const state = useCodeMirrorStateContext()
  const visualPreviewEnabled = useFeatureFlag('visual-preview')
  const isToolbarMigration = useFeatureFlag('writefull-toolbar-migration')
  const { features } = useProjectContext()
  const networkIsStalled = useIsNetworkStalled()
  return (
    <div className="ol-toolbar-layout-right">
      {networkIsStalled && <DownloadFileButton />}
      {!visualPreviewEnabled && <EditorSwitch />}
      {/* trackChangesVisible controls provider/UI availability; trackChanges
          (checked inside the switcher) controls the actual feature entitlement.
          Users with trackChangesVisible:true but trackChanges:false see the
          switcher and get an upgrade modal when clicking "Reviewing". */}
      {isToolbarMigration &&
        canUseWritefull !== false &&
        features.trackChangesVisible && <ReviewModeSwitcher />}
      {!isToolbarMigration && (
        <div
          style={{
            display: 'flex',
            visibility: canUseWritefull ? 'visible' : 'hidden',
          }}
        >
          {sourceEditorToolbarEndButtons.map(
            ({ import: { default: Component }, path }) => (
              <Component key={path} />
            )
          )}
        </div>
      )}
      <div
        style={{
          display: 'flex',
          visibility: canSearchInFile ? 'visible' : 'hidden',
        }}
      >
        <ToggleSearchButton state={state} />
      </div>
      <SwitchToPDFButton />
      {children}
    </div>
  )
}

type ToolbarLayoutCompoundComponent = ((
  props: ToolbarLayoutProps
) => JSX.Element) & {
  Left: typeof Left
  Right: typeof Right
}

export const ToolbarLayout = (({ children, className }: ToolbarLayoutProps) => (
  <div className={className}>{children}</div>
)) as ToolbarLayoutCompoundComponent

ToolbarLayout.Left = Left
ToolbarLayout.Right = Right
