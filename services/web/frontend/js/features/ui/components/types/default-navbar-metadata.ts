import type {
  NavbarItemData,
  NavbarSessionUser,
} from '@/features/ui/components/types/navbar'

export type DefaultNavbarMetadata = {
  customLogo?: string
  title?: string
  canDisplayAdminMenu: boolean
  canDisplayAdminRedirect: boolean
  canDisplaySplitTestMenu: boolean
  canDisplaySurveyMenu: boolean
  enableUpgradeButton: boolean
  suppressNavbarRight: boolean
  suppressNavContentLinks: boolean
  showSubscriptionLink: boolean
  sessionUser?: NavbarSessionUser
  adminUrl?: string
  items: NavbarItemData[]
}
