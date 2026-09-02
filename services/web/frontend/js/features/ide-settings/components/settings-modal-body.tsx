import MaterialIcon from '@/shared/components/material-icon'

import { Nav, NavLink, TabContainer, TabContent } from 'react-bootstrap'
import { SettingsEntry } from '../context/types'
import SettingsTabPane from './settings-tab-pane'

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
      activeKey={activeTab ?? undefined}
      id="ide-settings-tabs"
    >
      <div className="d-flex flex-row">
        <Nav
          activeKey={activeTab ?? undefined}
          className="d-flex flex-column ide-settings-tab-nav"
        >
          {settingsTabs.map(entry => (
            <SettingsNavLink entry={entry} key={entry.key} />
          ))}
        </Nav>
        <TabContent className="ide-settings-tab-content">
          {settingsTabs
            .filter(t => 'sections' in t)
            .map(tab => (
              <SettingsTabPane tab={tab} key={tab.key} />
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
        className="ide-settings-tab-link ide-settings-tab-link-anchor"
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
          className="ide-settings-tab-link ide-settings-tab-link-button"
          key={entry.key}
          as="button"
        >
          <MaterialIcon
            className="ide-settings-tab-link-icon"
            type={entry.icon}
            unfilled
          />
          <span>{entry.title}</span>
          <div className="flex-grow-1" />
        </NavLink>
      </>
    )
  }
}
