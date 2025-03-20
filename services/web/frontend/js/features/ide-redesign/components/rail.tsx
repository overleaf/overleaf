import { FC, ReactElement, useCallback, useMemo } from 'react'
import { Nav, NavLink, Tab, TabContainer } from 'react-bootstrap-5'
import MaterialIcon, {
  AvailableUnfilledIcon,
} from '@/shared/components/material-icon'
import { Panel } from 'react-resizable-panels'
import { useLayoutContext } from '@/shared/context/layout-context'
import { ErrorIndicator, ErrorPane } from './errors'
import {
  RailModalKey,
  RailTabKey,
  useRailContext,
} from '../contexts/rail-context'
import FileTreeOutlinePanel from './file-tree-outline-panel'
import { ChatIndicator, ChatPane } from './chat/chat'
import getMeta from '@/utils/meta'
import { HorizontalResizeHandle } from '@/features/ide-react/components/resize/horizontal-resize-handle'
import { HorizontalToggler } from '@/features/ide-react/components/resize/horizontal-toggler'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'
import IntegrationsPanel from './integrations-panel/integrations-panel'
import OLButton from '@/features/ui/components/ol/ol-button'
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

type RailElement = {
  icon: AvailableUnfilledIcon
  key: RailTabKey
  component: ReactElement
  indicator?: ReactElement
  hide?: boolean
}

type RailActionButton = {
  key: string
  icon: AvailableUnfilledIcon
  action: () => void
}
type RailDropdown = {
  key: string
  icon: AvailableUnfilledIcon
  dropdown: ReactElement
}
type RailAction = RailDropdown | RailActionButton

const RAIL_TABS: RailElement[] = [
  {
    key: 'file-tree',
    icon: 'description',
    component: <FileTreeOutlinePanel />,
  },
  {
    key: 'integrations',
    icon: 'integration_instructions',
    component: <IntegrationsPanel />,
  },
  {
    key: 'review-panel',
    icon: 'rate_review',
    component: <>Review panel</>,
  },
  {
    key: 'chat',
    icon: 'forum',
    component: <ChatPane />,
    indicator: <ChatIndicator />,
    hide: !getMeta('ol-chatEnabled'),
  },
  {
    key: 'errors',
    icon: 'report',
    component: <ErrorPane />,
    indicator: <ErrorIndicator />,
  },
]

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
  const { t } = useTranslation()
  const {
    activeModal,
    selectedTab,
    setSelectedTab,
    isOpen,
    setIsOpen,
    panelRef,
    handlePaneCollapse,
    handlePaneExpand,
    togglePane,
    setResizing,
  } = useRailContext()

  const { view, setLeftMenuShown } = useLayoutContext()

  const isHistoryView = view === 'history'

  const railActions: RailAction[] = useMemo(
    () => [
      {
        key: 'support',
        icon: 'help',
        dropdown: <RailHelpDropdown />,
      },
      {
        key: 'settings',
        icon: 'settings',
        action: () => setLeftMenuShown(true),
      },
    ],
    [setLeftMenuShown]
  )

  const onTabSelect = useCallback(
    (key: string | null) => {
      if (key === selectedTab) {
        togglePane()
      } else {
        // HACK: Apparently the onSelect event is triggered with href attributes
        // from DropdownItems
        if (!RAIL_TABS.some(tab => !tab.hide && tab.key === key)) {
          // Attempting to open a non-existent tab
          return
        }
        // Change the selected tab and make sure it's open
        setSelectedTab((key ?? 'file-tree') as RailTabKey)
        setIsOpen(true)
      }
    },
    [setSelectedTab, selectedTab, setIsOpen, togglePane]
  )

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
          {RAIL_TABS.filter(({ hide }) => !hide).map(
            ({ icon, key, indicator }) => (
              <RailTab
                open={isOpen && selectedTab === key}
                key={key}
                eventKey={key}
                icon={icon}
                indicator={indicator}
              />
            )
          )}
          <div className="flex-grow-1" />
          {railActions?.map(action => (
            <RailActionElement key={action.key} action={action} />
          ))}
        </Nav>
      </div>
      <Panel
        id="ide-redesign-sidebar-panel"
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
          className={classNames('ide-rail-content', { hidden: isHistoryView })}
        >
          <Tab.Content>
            {RAIL_TABS.filter(({ hide }) => !hide).map(({ key, component }) => (
              <Tab.Pane eventKey={key} key={key}>
                {component}
              </Tab.Pane>
            ))}
          </Tab.Content>
        </div>
      </Panel>
      <HorizontalResizeHandle
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

const RailTab = ({
  icon,
  eventKey,
  open,
  indicator,
}: {
  icon: AvailableUnfilledIcon
  eventKey: string
  open: boolean
  indicator?: ReactElement
}) => {
  return (
    <NavLink
      eventKey={eventKey}
      className={classNames('ide-rail-tab-link', {
        'open-rail': open,
      })}
    >
      {open ? (
        <MaterialIcon className="ide-rail-tab-link-icon" type={icon} />
      ) : (
        <MaterialIcon className="ide-rail-tab-link-icon" type={icon} unfilled />
      )}
      {indicator}
    </NavLink>
  )
}

const RailActionElement = ({ action }: { action: RailAction }) => {
  const icon = (
    <MaterialIcon
      className="ide-rail-tab-link-icon"
      type={action.icon}
      unfilled
    />
  )
  const onActionClick = useCallback(() => {
    if ('action' in action) {
      action.action()
    }
  }, [action])

  if ('dropdown' in action) {
    return (
      <Dropdown align="end" drop="end">
        <DropdownToggle
          id="rail-help-dropdown-btn"
          className="ide-rail-tab-link ide-rail-tab-button ide-rail-tab-dropdown"
          as="button"
        >
          {icon}
        </DropdownToggle>
        {action.dropdown}
      </Dropdown>
    )
  } else {
    return (
      <button
        onClick={onActionClick}
        className="ide-rail-tab-link ide-rail-tab-button"
        type="button"
      >
        {icon}
      </button>
    )
  }
}

export const RailPanelHeader: FC<{ title: string }> = ({ title }) => {
  const { handlePaneCollapse } = useRailContext()
  return (
    <header className="rail-panel-header">
      <h4 className="rail-panel-title">{title}</h4>
      <OLButton
        onClick={handlePaneCollapse}
        className="rail-panel-header-button-subdued"
        size="sm"
      >
        <MaterialIcon type="close" />
      </OLButton>
    </header>
  )
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
        href="https://forms.gle/soyVStc5qDx9na1Z6"
        role="menuitem"
        target="_blank"
        rel="noopener noreferrer"
      >
        {t('give_feedback')}
      </DropdownItem>
    </DropdownMenu>
  )
}
