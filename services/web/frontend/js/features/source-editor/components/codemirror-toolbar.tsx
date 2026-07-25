import {
  ElementType,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import {
  useCodeMirrorStateContext,
  useCodeMirrorViewContext,
} from './codemirror-context'
import { useResizeObserver } from '@/shared/hooks/use-resize-observer'
import { ToolbarItems } from './toolbar/toolbar-items'
import { ToolbarOverflow } from './toolbar/overflow'
import useDropdown from '../../../shared/hooks/use-dropdown'
import { getPanel } from '@codemirror/view'
import { createToolbarPanel } from '../extensions/toolbar/toolbar-panel'
import EditorSwitch from './editor-switch'
import ReviewModeSwitcher from '@/features/review-panel/components/review-mode-switcher'
import SwitchToPDFButton from './switch-to-pdf-button'
import { DetacherSynctexControl } from '../../pdf-preview/components/detach-synctex-control'
import DetachCompileButtonWrapper from '../../pdf-preview/components/detach-compile-button-wrapper'
import { isVisual } from '../extensions/visual/visual'
import { language } from '@codemirror/language'
import { minimumListDepthForSelection } from '../utils/tree-operations/ancestors'
import { debugConsole } from '@/utils/debugging'
import { useTranslation } from 'react-i18next'
import { ToggleSearchButton } from '@/features/source-editor/components/toolbar/toggle-search-button'
import ReviewPanelHeader from '@/features/review-panel/components/review-panel-header'
import useReviewPanelLayout from '@/features/review-panel/hooks/use-review-panel-layout'
import Breadcrumbs from '@/features/source-editor/extensions/breadcrumbs'
import classNames from 'classnames'
import { useUserSettingsContext } from '@/shared/context/user-settings-context'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import { useProjectContext } from '@/shared/context/project-context'
import importOverleafModules from '../../../../macros/import-overleaf-module.macro'
import { useLayoutContext } from '@/shared/context/layout-context'
import ReviewPanelHeaderBuffer from '@/features/review-panel/components/review-panel-header-buffer'
import { useAreTabsEnabled } from '@/features/ide-react/hooks/use-are-tabs-enabled'

const sourceEditorToolbarStartButtons = importOverleafModules(
  'sourceEditorToolbarStartButtons'
) as { import: { default: ElementType }; path: string }[]

const sourceEditorToolbarComponents = importOverleafModules(
  'sourceEditorToolbarComponents'
) as { import: { default: ElementType }; path: string }[]

const sourceEditorToolbarEndButtons = importOverleafModules(
  'sourceEditorToolbarEndButtons'
) as { import: { default: ElementType }; path: string }[]

export const CodeMirrorToolbar = () => {
  const view = useCodeMirrorViewContext()
  const panel = getPanel(view, createToolbarPanel)

  if (!panel) {
    return null
  }

  return createPortal(<Toolbar />, panel.dom)
}

const Toolbar = memo(function Toolbar() {
  const { t } = useTranslation()
  const state = useCodeMirrorStateContext()
  const view = useCodeMirrorViewContext()
  const {
    userSettings: { breadcrumbs },
  } = useUserSettingsContext()
  const visualPreviewEnabled = useFeatureFlag('visual-preview')
  const isToolbarMigration = useFeatureFlag('writefull-toolbar-migration')
  const { features } = useProjectContext()
  const { focusMode } = useLayoutContext()

  const [overflowed, setOverflowed] = useState(false)

  const overflowedItemsRef = useRef<Set<string>>(new Set())

  const languageName = state.facet(language)?.name
  const visual = isVisual(view)

  const listDepth = minimumListDepthForSelection(state)

  const { showHeader: showReviewPanelHeader } = useReviewPanelLayout()

  const {
    open: overflowOpen,
    onToggle: setOverflowOpen,
    ref: overflowRef,
  } = useDropdown()

  const buildOverflow = useCallback(
    (element: Element) => {
      debugConsole.log('recalculating toolbar overflow')

      setOverflowOpen(false)
      setOverflowed(true)

      overflowedItemsRef.current = new Set()

      const buttonGroups = [
        ...element.querySelectorAll<HTMLDivElement>('[data-overflow]'),
      ].reverse()

      // restore all the overflowed items
      for (const buttonGroup of buttonGroups) {
        buttonGroup.classList.remove('overflow-hidden')
      }

      // find all the available items
      for (const buttonGroup of buttonGroups) {
        if (element.scrollWidth <= element.clientWidth) {
          break
        }
        // add this item to the overflow
        overflowedItemsRef.current.add(buttonGroup.dataset.overflow!)
        buttonGroup.classList.add('overflow-hidden')
      }

      setOverflowed(overflowedItemsRef.current.size > 0)
    },
    [setOverflowOpen]
  )

  // calculate overflow when the container resizes
  const { elementRef, resizeRef } = useResizeObserver(buildOverflow)

  // calculate overflow when `languageName` or `visual` change
  useEffect(() => {
    if (resizeRef.current) {
      buildOverflow(resizeRef.current.element)
    }
  }, [buildOverflow, languageName, listDepth, resizeRef, visual])

  // calculate overflow when toolbar content changes
  const observerRef = useRef<MutationObserver | null>(null)
  const handleToolbar = useCallback(
    (node: HTMLDivElement) => {
      // register the resize observer on the toolbar node
      elementRef(node)

      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }

      if (!('MutationObserver' in window)) {
        return
      }

      if (node) {
        observerRef.current = new MutationObserver(() => {
          if (resizeRef.current) {
            buildOverflow(resizeRef.current.element)
          }
        })

        observerRef.current.observe(node, { childList: true, subtree: true })
      }
    },
    [buildOverflow, elementRef, resizeRef]
  )

  // calculate overflow when active element changes to/from inside a table
  const insideTable = document.activeElement?.closest(
    '.table-generator-help-modal,.table-generator,.table-generator-width-modal'
  )
  useEffect(() => {
    if (resizeRef.current) {
      buildOverflow(resizeRef.current.element)
    }
  }, [buildOverflow, insideTable, resizeRef])

  const showActions = !state.readOnly && !insideTable
  const tabsVisible = useAreTabsEnabled()

  if (focusMode) {
    return null
  }

  return (
    <>
      {showReviewPanelHeader &&
        (tabsVisible ? <ReviewPanelHeaderBuffer /> : <ReviewPanelHeader />)}
      <div
        id="ol-cm-toolbar-wrapper"
        className={classNames('ol-cm-toolbar-wrapper', {
          'ol-cm-toolbar-wrapper-indented': showReviewPanelHeader,
          // The border is only needed when the header is flush with the
          // toolbar, which is the case when tabs are disabled and the review
          // panel is shown
          'ol-cm-toolbar-wrapper-needs-border':
            showReviewPanelHeader && !tabsVisible,
        })}
      >
        <div
          role="toolbar"
          aria-label={t('toolbar_editor')}
          className="ol-cm-toolbar toolbar-editor"
          ref={handleToolbar}
        >
          {showActions &&
            sourceEditorToolbarStartButtons.map(
              ({ import: { default: Component }, path }) => (
                <Component key={path} />
              )
            )}
          {showActions && (
            <ToolbarItems
              state={state}
              languageName={languageName}
              visual={visual}
              listDepth={listDepth}
            />
          )}

          <div className="ol-cm-toolbar-button-group ol-cm-toolbar-stretch">
            {showActions && (
              <ToolbarOverflow
                overflowed={overflowed}
                overflowOpen={overflowOpen}
                setOverflowOpen={setOverflowOpen}
                overflowRef={overflowRef}
              >
                <ToolbarItems
                  state={state}
                  overflowed={overflowedItemsRef.current}
                  languageName={languageName}
                  visual={visual}
                  listDepth={listDepth}
                />
              </ToolbarOverflow>
            )}
          </div>

          <div className="ol-cm-toolbar-button-group ol-cm-toolbar-end">
            {!visualPreviewEnabled && <EditorSwitch />}
            {/* trackChangesVisible controls provider/UI availability; trackChanges
                (checked inside the switcher) controls the actual feature entitlement.
                Users with trackChangesVisible:true but trackChanges:false see the
                switcher and get an upgrade modal when clicking "Reviewing". */}
            {isToolbarMigration && features.trackChangesVisible && (
              <ReviewModeSwitcher />
            )}
            {sourceEditorToolbarEndButtons.map(
              ({ import: { default: Component }, path }) => (
                <Component key={path} />
              )
            )}
            <ToggleSearchButton state={state} />
            <SwitchToPDFButton />
            <DetacherSynctexControl />
            <DetachCompileButtonWrapper />
          </div>
        </div>
        {sourceEditorToolbarComponents.map(
          ({ import: { default: Component }, path }) => (
            <Component key={path} />
          )
        )}
        {breadcrumbs && <Breadcrumbs />}
      </div>
    </>
  )
})
