import { FC, RefObject, useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Nav, TabContainer } from 'react-bootstrap'
import { useLayoutContext } from '@/shared/context/layout-context'
import { RailTabKey, useRailContext } from '../../contexts/rail-context'
import FileTreeOutlinePanel from '../file-tree/file-tree-outline-panel'
import { ChatIndicator, ChatPane } from '../chat/chat'
import getMeta from '@/utils/meta'
import classNames from 'classnames'
import IntegrationsPanel from '../integrations-panel/integrations-panel'
import { useChatContext } from '@/features/chat/context/chat-context'
import { useEditorAnalytics } from '@/shared/hooks/use-editor-analytics'
import {
  FullProjectSearchPanel,
  hasFullProjectSearch,
} from '../full-project-search-panel'
import { sendSearchEvent } from '@/features/event-tracking/search-events'
import { useProjectContext } from '@/shared/context/project-context'
import { useCommandProvider } from '@/features/ide-react/hooks/use-command-provider'
import RailHelpDropdown from './rail-help-dropdown'
import RailTab from './rail-tab'
import RailActionElement, { RailAction } from './rail-action-element'
import { RailElement } from '../../utils/rail-types'
import RailPanel from './rail-panel'
import RailResizeHandle from './rail-resize-handle'
import RailModals from './rail-modals'
import RailOverflowDropdown from './rail-overflow-dropdown'
import useRailOverflow from '../../hooks/use-rail-overflow'
import EditorTourRailTooltip from '../editor-tour/editor-tour-rail-tooltip'
import importOverleafModules from '../../../../../macros/import-overleaf-module.macro'
import EditorTourThemeTooltip from '../editor-tour/editor-tour-theme-tooltip'
import EditorTourSwitchBackTooltip from '../editor-tour/editor-tour-switch-back-tooltip'
import { shouldIncludeElement } from '../../utils/rail-utils'
import { useEditorContext } from '@/shared/context/editor-context'

const moduleRailEntries = (
  importOverleafModules('railEntries') as {
    import: { default: RailElement }
    path: string
  }[]
).map(({ import: { default: element } }) => element)
const moduleRailPopovers = (
  importOverleafModules('railPopovers') as {
    import: {
      default: {
        key: string
        Component: FC<{ ref: RefObject<HTMLAnchorElement> }>
        ref: RefObject<HTMLAnchorElement>
        hide: boolean | (() => boolean)
      }
    }
    path: string
  }[]
).map(({ import: { default: element } }) => element)

export const RailLayout = () => {
  const { sendEvent } = useEditorAnalytics()
  const { t } = useTranslation()
  const { selectedTab, openTab, isOpen, togglePane } = useRailContext()
  const { features } = useProjectContext()
  const { isRestrictedTokenMember } = useEditorContext()
  const gitBridgeEnabled = getMeta('ol-gitBridgeEnabled')
  const { isOverleaf } = getMeta('ol-ExposedSettings')

  const { view, setLeftMenuShown } = useLayoutContext()

  const { markMessagesAsRead } = useChatContext()

  const isHistoryView = view === 'history'

  const fileTreeRef = useRef<HTMLAnchorElement>(null)
  const settingsRef = useRef<HTMLButtonElement>(null)

  const railTabs: RailElement[] = useMemo(
    () => [
      {
        key: 'file-tree',
        icon: 'description',
        title: t('file_tree'),
        component: <FileTreeOutlinePanel />,
        // NOTE: We always need to mount the file tree on first load
        // since it is responsible for opening the initial document.
        mountOnFirstLoad: true,
        ref: fileTreeRef,
      },
      {
        key: 'full-project-search',
        icon: 'search',
        title: t('project_search'),
        component: <FullProjectSearchPanel />,
        hide: !hasFullProjectSearch,
      },
      {
        key: 'integrations',
        icon: 'integration_instructions',
        title: t('integrations'),
        component: <IntegrationsPanel />,
        hide: !isOverleaf && !gitBridgeEnabled,
      },
      {
        key: 'review-panel',
        icon: 'rate_review',
        title: t('review_panel'),
        component: null,
        hide: !features.trackChangesVisible,
        disabled: view !== 'editor',
      },
      {
        key: 'chat',
        icon: 'forum',
        component: <ChatPane />,
        indicator: <ChatIndicator />,
        title: t('chat'),
        hide:
          !getMeta('ol-capabilities')?.includes('chat') ||
          isRestrictedTokenMember,
      },
      ...moduleRailEntries,
    ],
    [
      t,
      features.trackChangesVisible,
      view,
      isRestrictedTokenMember,
      isOverleaf,
      gitBridgeEnabled,
    ]
  )

  const railActions: RailAction[] = useMemo(
    () => [
      {
        key: 'support',
        icon: 'help',
        title: t('help'),
        dropdown: <RailHelpDropdown />,
      },
      {
        key: 'settings',
        icon: 'settings',
        title: t('settings'),
        action: () => {
          sendEvent('rail-click', { tab: 'settings' })
          setLeftMenuShown(true)
        },
        ref: settingsRef,
      },
    ],
    [setLeftMenuShown, t, sendEvent]
  )

  useCommandProvider(
    () => [
      {
        id: 'open-settings',
        handler: () => {
          setLeftMenuShown(true)
        },
        label: t('settings'),
      },
    ],
    [t, setLeftMenuShown]
  )

  const onTabSelect = useCallback(
    (key: string | null) => {
      if (key === selectedTab) {
        togglePane()
        sendEvent('rail-click', { tab: key, type: 'toggle' })
      } else {
        // HACK: Apparently the onSelect event is triggered with href attributes
        // from DropdownItems
        if (
          !railTabs.some(tab =>
            typeof tab.hide === 'function'
              ? !tab.hide()
              : !tab.hide && tab.key === key
          )
        ) {
          // Attempting to open a non-existent tab
          return
        }
        const keyOrDefault = (key ?? 'file-tree') as RailTabKey
        // Change the selected tab and make sure it's open
        openTab(keyOrDefault)
        sendEvent('rail-click', { tab: keyOrDefault })
        if (keyOrDefault === 'full-project-search') {
          sendSearchEvent('search-open', {
            searchType: 'full-project',
            method: 'button',
            location: 'rail',
          })
        }

        if (key === 'chat') {
          markMessagesAsRead()
        }
      }
    },
    [openTab, togglePane, selectedTab, railTabs, sendEvent, markMessagesAsRead]
  )

  useEffect(() => {
    const validTabKeys = railTabs
      .filter(shouldIncludeElement)
      .map(tab => tab.key)
    if (!validTabKeys.includes(selectedTab) && isOpen) {
      // If the selected tab is no longer valid (e.g. due to permissions changes),
      // switch back to the file tree
      openTab('file-tree')
    }
  }, [railTabs, selectedTab, openTab, isOpen])

  const isReviewPanelOpen =
    selectedTab === 'review-panel' && isOpen && !isHistoryView

  const { tabsInRail, tabsInOverflow, tabWrapperRef } =
    useRailOverflow(railTabs)

  const moreOptionsAction: RailAction = useMemo(() => {
    return {
      key: 'more-options',
      icon: 'more_vert',
      title: t('more_options'),
      hide: tabsInOverflow.length === 0,
      dropdown: (
        <RailOverflowDropdown
          tabs={tabsInOverflow}
          isOpen={isOpen}
          selectedTab={selectedTab}
        />
      ),
    }
  }, [t, isOpen, selectedTab, tabsInOverflow])

  return (
    <TabContainer
      mountOnEnter // Only render when necessary (so that we can lazy load tab content)
      unmountOnExit={false} // TODO: Should we unmount the tabs when they're not used?
      transition={false}
      activeKey={selectedTab}
      onSelect={onTabSelect}
      id="ide-rail-tabs"
    >
      {/* The <Nav> element is a "div" and has a "role="tablist"".
          But it should be identified as a navigation landmark.
          Therefore, we nest them: the parent <nav> is the landmark, and its child gets the "role="tablist"". */}
      <nav
        className={classNames('ide-rail', { hidden: isHistoryView })}
        aria-label={t('sidebar')}
      >
        <Nav activeKey={selectedTab} className="ide-rail-tabs-nav">
          <div className="ide-rail-tabs-wrapper" ref={tabWrapperRef}>
            {tabsInRail
              .filter(shouldIncludeElement)
              .map(({ icon, key, indicator, title, disabled, ref }) => (
                <RailTab
                  open={isOpen && selectedTab === key}
                  key={key}
                  eventKey={key}
                  icon={icon}
                  indicator={indicator}
                  title={title}
                  disabled={disabled}
                  ref={ref}
                />
              ))}
            <RailActionElement key="more-options" action={moreOptionsAction} />
          </div>
          <nav aria-label={t('help_editor_settings')}>
            {railActions.map(action => (
              <RailActionElement
                key={action.key}
                action={action}
                ref={action.ref}
              />
            ))}
          </nav>
        </Nav>
      </nav>
      <EditorTourRailTooltip target={fileTreeRef.current} />
      <EditorTourThemeTooltip target={settingsRef.current} />
      <EditorTourSwitchBackTooltip target={settingsRef.current} />
      {moduleRailPopovers
        .filter(shouldIncludeElement)
        .map(({ key, Component, ref }) => (
          <Component key={key} ref={ref} />
        ))}
      <RailPanel
        isReviewPanelOpen={isReviewPanelOpen}
        isHistoryView={isHistoryView}
        railTabs={railTabs}
      />
      <RailResizeHandle isReviewPanelOpen={isReviewPanelOpen} />
      <RailModals />
    </TabContainer>
  )
}
