import {
  FC,
  forwardRef,
  ReactElement,
  useCallback,
  useMemo,
  useRef,
} from 'react'
import { useTranslation } from 'react-i18next'
import { Nav, NavLink, Tab, TabContainer } from 'react-bootstrap'
import MaterialIcon, {
  AvailableUnfilledIcon,
} from '@/shared/components/material-icon'
import { Panel } from 'react-resizable-panels'
import { useLayoutContext } from '@/shared/context/layout-context'
import ErrorIndicator from './error-logs/error-indicator'
import {
  RailModalKey,
  RailTabKey,
  useRailContext,
} from '../contexts/rail-context'
import FileTreeOutlinePanel from './file-tree/file-tree-outline-panel'
import { ChatIndicator, ChatPane } from './chat/chat'
import getMeta from '@/utils/meta'
import { HorizontalResizeHandle } from '@/features/ide-react/components/resize/horizontal-resize-handle'
import { HorizontalToggler } from '@/features/ide-react/components/resize/horizontal-toggler'
import classNames from 'classnames'
import IntegrationsPanel from './integrations-panel/integrations-panel'
import {
  Dropdown,
  DropdownDivider,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
} from '@/features/ui/components/bootstrap-5/dropdown-menu'
import { RailHelpShowHotkeysModal } from './help/keyboard-shortcuts'
import { RailHelpContactUsModal } from './help/contact-us'
import { HistorySidebar } from '@/features/ide-react/components/history-sidebar'
import DictionarySettingsModal from './settings/editor-settings/dictionary-settings-modal'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import OLIconButton from '@/features/ui/components/ol/ol-icon-button'
import { useChatContext } from '@/features/chat/context/chat-context'
import { useEditorAnalytics } from '@/shared/hooks/use-editor-analytics'
import {
  FullProjectSearchPanel,
  hasFullProjectSearch,
} from './full-project-search-panel'
import { sendSearchEvent } from '@/features/event-tracking/search-events'
import ErrorLogsPanel from './error-logs/error-logs-panel'
import { useDetachCompileContext as useCompileContext } from '@/shared/context/detach-compile-context'
import OldErrorPane from './error-logs/old-error-pane'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import { useSurveyUrl } from '../hooks/use-survey-url'
import NewErrorLogsPromo from './error-logs/new-error-logs-promo'
import { useProjectContext } from '@/shared/context/project-context'

type RailElement = {
  icon: AvailableUnfilledIcon
  key: RailTabKey
  component: ReactElement | null
  indicator?: ReactElement
  title: string
  hide?: boolean
  disabled?: boolean
}

type RailActionButton = {
  key: string
  icon: AvailableUnfilledIcon
  title: string
  action: () => void
}
type RailDropdown = {
  key: string
  icon: AvailableUnfilledIcon
  title: string
  dropdown: ReactElement
}
type RailAction = RailDropdown | RailActionButton

const RAIL_MODALS: {
  key: RailModalKey
  modalComponentFunction: FC<{ show: boolean }>
}[] = [
  {
    key: 'keyboard-shortcuts',
    modalComponentFunction: RailHelpShowHotkeysModal,
  },
  {
    key: 'contact-us',
    modalComponentFunction: RailHelpContactUsModal,
  },
  {
    key: 'dictionary',
    modalComponentFunction: DictionarySettingsModal,
  },
]

export const RailLayout = () => {
  const { sendEvent } = useEditorAnalytics()
  const { t } = useTranslation()
  const {
    activeModal,
    selectedTab,
    openTab,
    isOpen,
    setIsOpen,
    panelRef,
    handlePaneCollapse,
    handlePaneExpand,
    togglePane,
    setResizing,
  } = useRailContext()
  const { logEntries } = useCompileContext()
  const { features } = useProjectContext()
  const errorLogsDisabled = !logEntries

  const errorsTabRef = useRef<HTMLAnchorElement>(null)

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
    [t, features.trackChangesVisible, newErrorlogs, errorLogsDisabled]
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

  return (
    <TabContainer
      mountOnEnter // Only render when necessary (so that we can lazy load tab content)
      unmountOnExit={false} // TODO: Should we unmount the tabs when they're not used?
      transition={false}
      activeKey={selectedTab}
      onSelect={onTabSelect}
      id="ide-rail-tabs"
    >
      <div className={classNames('ide-rail', { hidden: isHistoryView })}>
        <Nav activeKey={selectedTab} className="ide-rail-tabs-nav">
          {railTabs
            .filter(({ hide }) => !hide)
            .map(({ icon, key, indicator, title, disabled }) => (
              <RailTab
                ref={key === 'errors' ? errorsTabRef : null}
                open={isOpen && selectedTab === key}
                key={key}
                eventKey={key}
                icon={icon}
                indicator={indicator}
                title={title}
                disabled={disabled}
              />
            ))}
          <div className="flex-grow-1" />
          {railActions?.map(action => (
            <RailActionElement key={action.key} action={action} />
          ))}
          {newErrorlogs && <NewErrorLogsPromo target={errorsTabRef.current} />}
        </Nav>
      </div>
      <Panel
        id={
          newErrorlogs
            ? `ide-redesign-sidebar-panel-${selectedTab}`
            : 'ide-redesign-sidebar-panel'
        }
        className={classNames({ hidden: isReviewPanelOpen })}
        order={1}
        defaultSize={15}
        minSize={5}
        maxSize={80}
        ref={panelRef}
        collapsible
        onCollapse={handlePaneCollapse}
        onExpand={handlePaneExpand}
      >
        {isHistoryView && <HistorySidebar />}
        <div
          className={classNames('ide-rail-content', {
            hidden: isHistoryView,
          })}
        >
          <Tab.Content className="ide-rail-tab-content">
            {railTabs
              .filter(({ hide }) => !hide)
              .map(({ key, component }) => (
                <Tab.Pane eventKey={key} key={key}>
                  {component}
                </Tab.Pane>
              ))}
          </Tab.Content>
        </div>
      </Panel>
      <HorizontalResizeHandle
        className={classNames({ hidden: isReviewPanelOpen })}
        resizable
        hitAreaMargins={{ coarse: 0, fine: 0 }}
        onDoubleClick={togglePane}
        onDragging={setResizing}
      >
        <HorizontalToggler
          id="ide-redesign-sidebar-panel"
          togglerType="west"
          isOpen={isOpen}
          setIsOpen={setIsOpen}
          tooltipWhenOpen={t('tooltip_hide_panel')}
          tooltipWhenClosed={t('tooltip_show_panel')}
        />
      </HorizontalResizeHandle>
      {RAIL_MODALS.map(({ key, modalComponentFunction: Component }) => (
        <Component key={key} show={activeModal === key} />
      ))}
    </TabContainer>
  )
}

const RailTab = forwardRef<
  HTMLAnchorElement,
  {
    icon: AvailableUnfilledIcon
    eventKey: string
    open: boolean
    indicator?: ReactElement
    title: string
    disabled?: boolean
  }
>(({ icon, eventKey, open, indicator, title, disabled = false }, ref) => {
  return (
    <OLTooltip
      id={`rail-tab-tooltip-${eventKey}`}
      description={title}
      overlayProps={{ delay: 0, placement: 'right' }}
    >
      <NavLink
        ref={ref}
        eventKey={eventKey}
        className={classNames('ide-rail-tab-link', {
          'open-rail': open,
        })}
        disabled={disabled}
      >
        {open ? (
          <MaterialIcon
            className="ide-rail-tab-link-icon"
            type={icon}
            accessibilityLabel={title}
          />
        ) : (
          <MaterialIcon
            className="ide-rail-tab-link-icon"
            type={icon}
            accessibilityLabel={title}
            unfilled
          />
        )}
        {indicator}
      </NavLink>
    </OLTooltip>
  )
})

RailTab.displayName = 'RailTab'

const RailActionElement = ({ action }: { action: RailAction }) => {
  const onActionClick = useCallback(() => {
    if ('action' in action) {
      action.action()
    }
  }, [action])

  if ('dropdown' in action) {
    return (
      <Dropdown align="end" drop="end">
        <OLTooltip
          id={`rail-dropdown-tooltip-${action.key}`}
          description={action.title}
          overlayProps={{ delay: 0, placement: 'right' }}
        >
          <span>
            <DropdownToggle
              id="rail-help-dropdown-btn"
              className="ide-rail-tab-link ide-rail-tab-button ide-rail-tab-dropdown"
              as="button"
              aria-label={action.title}
            >
              <MaterialIcon
                className="ide-rail-tab-link-icon"
                type={action.icon}
                unfilled
              />
            </DropdownToggle>
          </span>
        </OLTooltip>
        {action.dropdown}
      </Dropdown>
    )
  } else {
    return (
      <OLTooltip
        id={`rail-tab-tooltip-${action.key}`}
        description={action.title}
        overlayProps={{ delay: 0, placement: 'right' }}
      >
        <OLIconButton
          onClick={onActionClick}
          className="ide-rail-tab-link ide-rail-tab-button"
          icon={action.icon}
          accessibilityLabel={action.title}
          unfilled
        />
      </OLTooltip>
    )
  }
}

const RailHelpDropdown = () => {
  const showSupport = getMeta('ol-showSupport')
  const { t } = useTranslation()
  const { setActiveModal } = useRailContext()
  const openKeyboardShortcutsModal = useCallback(() => {
    setActiveModal('keyboard-shortcuts')
  }, [setActiveModal])
  const openContactUsModal = useCallback(() => {
    setActiveModal('contact-us')
  }, [setActiveModal])
  const surveyURL = useSurveyUrl()

  return (
    <DropdownMenu>
      <DropdownItem onClick={openKeyboardShortcutsModal}>
        {t('keyboard_shortcuts')}
      </DropdownItem>
      <DropdownItem
        href="/learn"
        role="menuitem"
        target="_blank"
        rel="noopener noreferrer"
      >
        {t('documentation')}
      </DropdownItem>
      <DropdownDivider />
      {showSupport && (
        <DropdownItem onClick={openContactUsModal}>
          {t('contact_us')}
        </DropdownItem>
      )}
      <DropdownItem
        href={surveyURL}
        role="menuitem"
        target="_blank"
        rel="noopener noreferrer"
      >
        {t('give_feedback')}
      </DropdownItem>
    </DropdownMenu>
  )
}
