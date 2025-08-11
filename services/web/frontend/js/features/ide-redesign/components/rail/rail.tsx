import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Nav, TabContainer } from 'react-bootstrap'
import { useLayoutContext } from '@/shared/context/layout-context'
import ErrorIndicator from '../error-logs/error-indicator'
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
import ErrorLogsPanel from '../error-logs/error-logs-panel'
import { useDetachCompileContext as useCompileContext } from '@/shared/context/detach-compile-context'
import OldErrorPane from '../error-logs/old-error-pane'
import { useFeatureFlag } from '@/shared/context/split-test-context'
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

export const RailLayout = () => {
  const { sendEvent } = useEditorAnalytics()
  const { t } = useTranslation()
  const { selectedTab, openTab, isOpen, togglePane } = useRailContext()
  const { logEntries } = useCompileContext()
  const { features } = useProjectContext()
  const errorLogsDisabled = !logEntries

  const { view, setLeftMenuShown } = useLayoutContext()

  const { markMessagesAsRead } = useChatContext()

  const isHistoryView = view === 'history'

  const newErrorlogs = useFeatureFlag('new-editor-error-logs-redesign')

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
        hide: !getMeta('ol-capabilities')?.includes('chat'),
      },
      {
        key: 'errors',
        icon: 'report',
        title: t('error_log'),
        component: newErrorlogs ? <ErrorLogsPanel /> : <OldErrorPane />,
        indicator: <ErrorIndicator />,
        disabled: errorLogsDisabled,
      },
    ],
    [t, features.trackChangesVisible, newErrorlogs, errorLogsDisabled, view]
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
        if (!railTabs.some(tab => !tab.hide && tab.key === key)) {
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

  const isReviewPanelOpen = selectedTab === 'review-panel'

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
        aria-label={t('files_collaboration_integrations_logs')}
      >
        <Nav activeKey={selectedTab} className="ide-rail-tabs-nav">
          <div className="ide-rail-tabs-wrapper" ref={tabWrapperRef}>
            {tabsInRail
              .filter(({ hide }) => !hide)
              .map(({ icon, key, indicator, title, disabled }) => (
                <RailTab
                  open={isOpen && selectedTab === key}
                  key={key}
                  eventKey={key}
                  icon={icon}
                  indicator={indicator}
                  title={title}
                  disabled={disabled}
                />
              ))}
            <RailActionElement key="more-options" action={moreOptionsAction} />
          </div>
          <nav aria-label={t('help_editor_settings')}>
            {railActions.map(action => (
              <RailActionElement key={action.key} action={action} />
            ))}
          </nav>
        </Nav>
      </nav>
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
