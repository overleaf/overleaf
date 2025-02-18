import { ReactElement, useCallback, useMemo } from 'react'
import { Nav, NavLink, Tab, TabContainer } from 'react-bootstrap-5'
import MaterialIcon, {
  AvailableUnfilledIcon,
} from '@/shared/components/material-icon'
import { Panel } from 'react-resizable-panels'
import { useLayoutContext } from '@/shared/context/layout-context'
import { ErrorIndicator, ErrorPane } from './errors'
import { RailTabKey, useRailContext } from '../contexts/rail-context'
import FileTreeOutlinePanel from './file-tree-outline-panel'
import { ChatIndicator, ChatPane } from './chat'
import getMeta from '@/utils/meta'
import { HorizontalResizeHandle } from '@/features/ide-react/components/resize/horizontal-resize-handle'
import { HorizontalToggler } from '@/features/ide-react/components/resize/horizontal-toggler'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'
import IntegrationsPanel from './integrations-panel/integrations-panel'

type RailElement = {
  icon: AvailableUnfilledIcon
  key: RailTabKey
  component: ReactElement
  indicator?: ReactElement
  hide?: boolean
}

type RailActionLink = { key: string; icon: AvailableUnfilledIcon; href: string }
type RailActionButton = {
  key: string
  icon: AvailableUnfilledIcon
  action: () => void
}
type RailAction = RailActionLink | RailActionButton

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

export const RailLayout = () => {
  const { t } = useTranslation()
  const {
    selectedTab,
    setSelectedTab,
    isOpen,
    setIsOpen,
    panelRef,
    handlePaneCollapse,
    handlePaneExpand,
    togglePane,
  } = useRailContext()

  const { setLeftMenuShown } = useLayoutContext()
  const railActions: RailAction[] = useMemo(
    () => [
      { key: 'support', icon: 'help', href: '/learn' },
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
      <div className="ide-rail">
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
        <div className="ide-rail-content">
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

  if ('href' in action) {
    return (
      <a
        href={action.href}
        target="_blank"
        rel="noopener"
        className="ide-rail-tab-link"
      >
        {icon}
      </a>
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
