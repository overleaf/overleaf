import MaterialIcon, {
  AvailableUnfilledIcon,
} from '@/shared/components/material-icon'
import { ReactElement } from 'react'

import {
  Nav,
  NavLink,
  TabContainer,
  TabContent,
  TabPane,
} from 'react-bootstrap'

export type SettingsEntry = SettingsLink | SettingsTab

type SettingsTab = {
  icon: AvailableUnfilledIcon
  key: string
  component: ReactElement
  title: string
}

type SettingsLink = {
  key: string
  icon: AvailableUnfilledIcon
  href: string
  title: string
}

export const SettingsModalBody = ({
  activeTab,
  setActiveTab,
  settingsTabs,
}: {
  activeTab: string | null | undefined
  setActiveTab: (tab: string | null | undefined) => void
  settingsTabs: SettingsEntry[]
}) => {
  return (
    <TabContainer
      transition={false}
      onSelect={setActiveTab}
      defaultActiveKey={activeTab ?? undefined}
      id="ide-settings-tabs"
    >
      <div className="d-flex flex-row">
        <Nav
          defaultActiveKey={settingsTabs[0]?.key}
          className="d-flex flex-column ide-settings-tab-nav"
        >
          {settingsTabs.map(entry => (
            <SettingsNavLink entry={entry} key={entry.key} />
          ))}
        </Nav>
        <TabContent className="ide-settings-tab-content">
          {settingsTabs
            .filter(t => 'component' in t)
            .map(({ key, component }) => (
              <TabPane eventKey={key} key={key}>
                {component}
              </TabPane>
            ))}
        </TabContent>
      </div>
    </TabContainer>
  )
}

const SettingsNavLink = ({ entry }: { entry: SettingsEntry }) => {
  if ('href' in entry) {
    return (
      <a
        href={entry.href}
        target="_blank"
        rel="noopener"
        className="ide-settings-tab-link"
      >
        <MaterialIcon
          className="ide-settings-tab-link-icon"
          type={entry.icon}
          unfilled
        />
        <span>{entry.title}</span>
        <div className="flex-grow-1" />
        <MaterialIcon
          type="open_in_new"
          className="ide-settings-tab-link-external"
        />
      </a>
    )
  } else {
    return (
      <>
        <NavLink
          eventKey={entry.key}
          className="ide-settings-tab-link"
          key={entry.key}
        >
          <MaterialIcon
            className="ide-settings-tab-link-icon"
            type={entry.icon}
            unfilled
          />
          <span>{entry.title}</span>
        </NavLink>
      </>
    )
  }
}
