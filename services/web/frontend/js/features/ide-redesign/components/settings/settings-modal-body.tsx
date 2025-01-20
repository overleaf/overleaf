import MaterialIcon, {
  AvailableUnfilledIcon,
} from '@/shared/components/material-icon'
import { ReactElement, useMemo, useState } from 'react'
import {
  Nav,
  NavLink,
  TabContainer,
  TabContent,
  TabPane,
} from 'react-bootstrap-5'
import { useTranslation } from 'react-i18next'

export type SettingsEntry = SettingsLink | SettingsTab

type SettingsTab = {
  icon: AvailableUnfilledIcon
  key: string
  component: ReactElement
  title: string
  subtitle: string
}

type SettingsLink = {
  key: string
  icon: AvailableUnfilledIcon
  href: string
  title: string
}

export const SettingsModalBody = () => {
  const { t } = useTranslation()
  const settingsTabs: SettingsEntry[] = useMemo(
    () => [
      {
        key: 'general',
        title: t('general'),
        subtitle: t('general_settings'),
        icon: 'settings',
        component: <div>General</div>,
      },
      {
        key: 'editor',
        title: t('editor'),
        subtitle: t('editor_settings'),
        icon: 'code',
        component: <div>Editor</div>,
      },
      {
        key: 'pdf',
        title: t('pdf'),
        subtitle: t('pdf_settings'),
        icon: 'picture_as_pdf',
        component: <div>PDF</div>,
      },
      {
        key: 'interface',
        title: t('interface'),
        subtitle: t('interface_settings'),
        icon: 'web_asset',
        component: <div>Interface</div>,
      },
      {
        key: 'account_settings',
        title: t('account_settings'),
        icon: 'settings',
        href: '/user/settings',
      },
    ],
    [t]
  )
  const [activeTab, setActiveTab] = useState<string | null | undefined>(
    settingsTabs[0]?.key
  )

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
        <TabContent>
          {settingsTabs
            .filter(t => 'component' in t)
            .map(({ key, component, subtitle }) => (
              <TabPane eventKey={key} key={key}>
                <p className="ide-settings-tab-subtitle">{subtitle}</p>
                <div className="ide-settings-tab-content">{component}</div>
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
