import { ReactElement, useCallback, useState } from 'react'
import { Nav, NavLink, Tab, TabContainer } from 'react-bootstrap-5'
import MaterialIcon, {
  AvailableUnfilledIcon,
} from '@/shared/components/material-icon'
import { Panel } from 'react-resizable-panels'

type RailElement = {
  icon: AvailableUnfilledIcon
  key: string
  component: ReactElement
}

const RAIL_TABS: RailElement[] = [
  // NOTE: The file tree **MUST** be the first (i.e. default) tab in the list
  //       since the file tree is responsible for opening the initial document.
  {
    key: 'file-tree',
    icon: 'description',
    component: <>File tree</>,
  },
  {
    key: 'integrations',
    icon: 'integration_instructions',
    component: <>Integrations</>,
  },
  {
    key: 'review-panel',
    icon: 'rate_review',
    component: <>Review panel</>,
  },
  {
    key: 'chat',
    icon: 'forum',
    component: <>Chat</>,
  },
  {
    key: 'errors',
    icon: 'report',
    component: <>Errors</>,
  },
]

export const RailLayout = () => {
  const [selectedTab, setSelectedTab] = useState<string | undefined>(
    RAIL_TABS[0]?.key
  )
  return (
    <TabContainer
      mountOnEnter // Only render when necessary (so that we can lazy load tab content)
      unmountOnExit={false} // TODO: Should we unmount the tabs when they're not used?
      transition={false}
      defaultActiveKey={selectedTab}
      onSelect={useCallback(key => setSelectedTab(key ?? undefined), [])}
      id="ide-rail-tabs"
    >
      <div className="ide-rail">
        <Nav defaultActiveKey={RAIL_TABS[0]?.key} className="flex-column">
          {RAIL_TABS.map(({ icon, key }) => (
            <RailTab
              active={selectedTab === key}
              key={key}
              eventKey={key}
              icon={icon}
            />
          ))}
        </Nav>
      </div>
      <Panel
        id="ide-redesign-sidebar-panel"
        order={1}
        defaultSize={15}
        minSize={5}
        maxSize={80}
      >
        <div className="ide-rail-content">
          <Tab.Content>
            {RAIL_TABS.map(({ key, component }) => (
              <Tab.Pane eventKey={key} key={key}>
                {component}
              </Tab.Pane>
            ))}
          </Tab.Content>
        </div>
      </Panel>
    </TabContainer>
  )
}

const RailTab = ({
  icon,
  eventKey,
  active,
}: {
  icon: AvailableUnfilledIcon
  eventKey: string
  active: boolean
}) => {
  return (
    <NavLink eventKey={eventKey} className="ide-rail-tab-link">
      <MaterialIcon
        className="ide-rail-tab-link-icon"
        type={icon}
        unfilled={!active}
      />
    </NavLink>
  )
}
