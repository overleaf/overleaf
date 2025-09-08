import { TabPane } from 'react-bootstrap'
import { SettingsTab } from '../../contexts/settings-modal-context'
import SettingsSection from './settings-section'
import { Fragment } from 'react'

export default function SettingsTabPane({ tab }: { tab: SettingsTab }) {
  const { key, sections } = tab
  return (
    <TabPane eventKey={key} key={key}>
      {sections.map(section => (
        <SettingsSection key={section.key} title={section.title}>
          {section.settings.map(
            ({ key, component, hidden }) =>
              !hidden && <Fragment key={key}>{component}</Fragment>
          )}
        </SettingsSection>
      ))}
    </TabPane>
  )
}
