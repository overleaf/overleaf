// this import fails linting in CI if from '@ol-types/utils' so as a temporary workaround we'll use the relative path
import { mkLiteralUnionTypeguard } from '../../utils'
import { CurrencyCode } from '../currency'

export type GroupPlans = {
  plans: {
    display: string
    code: string
  }[]
  sizes: string[]
}

export const planTypeGroup = ['collaborator', 'professional'] as const
export type PlanTypeGroup = (typeof planTypeGroup)[number]
export const isPlanTypeGroup = mkLiteralUnionTypeguard(planTypeGroup)

export const planUsageType = ['enterprise', 'educational'] as const
export type PlanUsageType = (typeof planUsageType)[number]
export const isPlanUsageType = mkLiteralUnionTypeguard(planUsageType)

export const licenseSize = ['2', '3', '4', '5', '10', '20'] as const
export type LicenseSize = (typeof licenseSize)[number]
export const isLicenseSize = mkLiteralUnionTypeguard(licenseSize)

export type LicensePrice = {
  price_in_cents: number
  additional_license_legacy_price_in_cents: number
}

export type PlanPriceByLicenseSize = Record<LicenseSize, LicensePrice>

export type PlanByCurrencyCode = Record<CurrencyCode, PlanPriceByLicenseSize>

export type PlansByPlanTypeGroup = Record<PlanTypeGroup, PlanByCurrencyCode>

export type GroupPlansData = Record<PlanUsageType, PlansByPlanTypeGroup>
