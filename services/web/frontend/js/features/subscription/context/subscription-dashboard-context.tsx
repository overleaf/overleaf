import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import {
  CustomSubscription,
  ManagedGroupSubscription,
  MemberGroupSubscription,
  RecurlySubscription,
} from '../../../../../types/subscription/dashboard/subscription'
import {
  Plan,
  PriceForDisplayData,
} from '../../../../../types/subscription/plan'
import { Institution } from '../../../../../types/institution'
import getMeta from '../../../utils/meta'
import {
  loadDisplayPriceWithTaxPromise,
  loadGroupDisplayPriceWithTaxPromise,
} from '../util/recurly-pricing'
import { isRecurlyLoaded } from '../util/is-recurly-loaded'
import { SubscriptionDashModalIds } from '../../../../../types/subscription/dashboard/modal-ids'
import { debugConsole } from '@/utils/debugging'
import { formatCurrency } from '@/shared/utils/currency'
import { ManagedInstitution } from '../../../../../types/subscription/dashboard/managed-institution'
import { Publisher } from '../../../../../types/subscription/dashboard/publisher'
import { formatTime } from '@/features/utils/format-date'

type SubscriptionDashboardContextValue = {
  groupPlanToChangeToCode: string
  groupPlanToChangeToSize: string
  groupPlanToChangeToUsage: string
  groupPlanToChangeToPrice?: PriceForDisplayData
  groupPlanToChangeToPriceError?: boolean
  handleCloseModal: () => void
  handleOpenModal: (
    modalIdToOpen: SubscriptionDashModalIds,
    planCode?: string
  ) => void
  hasDisplayedSubscription: boolean
  hasValidActiveSubscription: boolean
  institutionMemberships?: Institution[]
  managedGroupSubscriptions: ManagedGroupSubscription[]
  memberGroupSubscriptions: MemberGroupSubscription[]
  managedInstitutions: ManagedInstitution[]
  managedPublishers: Publisher[]
  updateManagedInstitution: (institution: ManagedInstitution) => void
  modalIdShown?: SubscriptionDashModalIds
  personalSubscription?: RecurlySubscription | CustomSubscription
  hasSubscription: boolean
  plans: Plan[]
  planCodeToChangeTo?: string
  queryingGroupPlanToChangeToPrice: boolean
  queryingIndividualPlansData: boolean
  recurlyLoadError: boolean
  setGroupPlanToChangeToCode: React.Dispatch<React.SetStateAction<string>>
  setGroupPlanToChangeToSize: React.Dispatch<React.SetStateAction<string>>
  setGroupPlanToChangeToUsage: React.Dispatch<React.SetStateAction<string>>
  setModalIdShown: React.Dispatch<
    React.SetStateAction<SubscriptionDashModalIds | undefined>
  >
  setPlanCodeToChangeTo: React.Dispatch<
    React.SetStateAction<string | undefined>
  >
  setRecurlyLoadError: React.Dispatch<React.SetStateAction<boolean>>
  showCancellation: boolean
  setShowCancellation: React.Dispatch<React.SetStateAction<boolean>>
  leavingGroupId?: string
  setLeavingGroupId: React.Dispatch<React.SetStateAction<string | undefined>>
  userCanExtendTrial: boolean
  getFormattedRenewalDate: () => string
}

export const SubscriptionDashboardContext = createContext<
  SubscriptionDashboardContextValue | undefined
>(undefined)

export function SubscriptionDashboardProvider({
  children,
}: {
  children: ReactNode
}) {
  const { i18n } = useTranslation()
  const [modalIdShown, setModalIdShown] = useState<
    SubscriptionDashModalIds | undefined
  >()
  const [recurlyLoadError, setRecurlyLoadError] = useState(false)
  const [showCancellation, setShowCancellation] = useState(false)
  const [plans, setPlans] = useState<Plan[]>([])
  const [queryingIndividualPlansData, setQueryingIndividualPlansData] =
    useState(true)
  const [planCodeToChangeTo, setPlanCodeToChangeTo] = useState<
    string | undefined
  >()
  const [groupPlanToChangeToSize, setGroupPlanToChangeToSize] = useState('10')
  const [groupPlanToChangeToCode, setGroupPlanToChangeToCode] =
    useState('collaborator')
  const [groupPlanToChangeToUsage, setGroupPlanToChangeToUsage] =
    useState('enterprise')
  const [
    queryingGroupPlanToChangeToPrice,
    setQueryingGroupPlanToChangeToPrice,
  ] = useState(false)
  const [groupPlanToChangeToPrice, setGroupPlanToChangeToPrice] =
    useState<PriceForDisplayData>()
  const [groupPlanToChangeToPriceError, setGroupPlanToChangeToPriceError] =
    useState(false)
  const [leavingGroupId, setLeavingGroupId] = useState<string | undefined>()

  const plansWithoutDisplayPrice = getMeta('ol-plans')
  const institutionMemberships = getMeta('ol-currentInstitutionsWithLicence')
  const personalSubscription = getMeta('ol-subscription')
  const userCanExtendTrial = getMeta('ol-userCanExtendTrial')
  const managedGroupSubscriptions = getMeta('ol-managedGroupSubscriptions')
  const memberGroupSubscriptions = getMeta('ol-memberGroupSubscriptions')
  const [managedInstitutions, setManagedInstitutions] = useState(
    getMeta('ol-managedInstitutions')
  )
  const managedPublishers = getMeta('ol-managedPublishers')
  const hasSubscription = getMeta('ol-hasSubscription')
  const recurlyApiKey = getMeta('ol-recurlyApiKey')

  const hasDisplayedSubscription = Boolean(
    institutionMemberships?.length > 0 ||
      personalSubscription ||
      memberGroupSubscriptions?.length > 0 ||
      managedGroupSubscriptions?.length > 0 ||
      managedInstitutions?.length > 0 ||
      managedPublishers?.length > 0
  )

  const hasValidActiveSubscription = Boolean(
    ['active', 'canceled'].includes(personalSubscription?.recurly?.state) ||
      institutionMemberships?.length > 0 ||
      memberGroupSubscriptions?.length > 0
  )

  const getFormattedRenewalDate = useCallback(() => {
    if (
      !personalSubscription.recurly.pausedAt ||
      !personalSubscription.recurly.remainingPauseCycles
    ) {
      return personalSubscription.recurly.nextPaymentDueAt
    }
    const pausedDate = new Date(personalSubscription.recurly.pausedAt)
    pausedDate.setMonth(
      pausedDate.getMonth() + personalSubscription.recurly.remainingPauseCycles
    )
    return formatTime(pausedDate, 'MMMM Do, YYYY')
  }, [personalSubscription])

  useEffect(() => {
    if (!isRecurlyLoaded()) {
      setRecurlyLoadError(true)
    } else if (recurlyApiKey) {
      recurly.configure(recurlyApiKey)
    }
  }, [recurlyApiKey, setRecurlyLoadError])

  useEffect(() => {
    if (
      isRecurlyLoaded() &&
      plansWithoutDisplayPrice &&
      personalSubscription?.recurly
    ) {
      const { currency, taxRate } = personalSubscription.recurly
      const fetchPlansDisplayPrices = async () => {
        for (const plan of plansWithoutDisplayPrice) {
          try {
            const priceData = await loadDisplayPriceWithTaxPromise(
              plan.planCode,
              currency,
              taxRate,
              i18n.language
            )
            if (priceData?.totalAsNumber !== undefined) {
              plan.displayPrice = formatCurrency(
                priceData.totalAsNumber,
                currency,
                i18n.language
              )
            }
          } catch (error) {
            debugConsole.error(error)
          }
        }
        setPlans(plansWithoutDisplayPrice)
        setQueryingIndividualPlansData(false)
      }
      fetchPlansDisplayPrices().catch(debugConsole.error)
    }
  }, [personalSubscription, plansWithoutDisplayPrice, i18n.language])

  useEffect(() => {
    if (
      isRecurlyLoaded() &&
      groupPlanToChangeToCode &&
      groupPlanToChangeToSize &&
      groupPlanToChangeToUsage &&
      personalSubscription?.recurly
    ) {
      setQueryingGroupPlanToChangeToPrice(true)

      const { currency, taxRate } = personalSubscription.recurly
      const fetchGroupDisplayPrice = async () => {
        setGroupPlanToChangeToPriceError(false)
        let priceData
        try {
          priceData = await loadGroupDisplayPriceWithTaxPromise(
            groupPlanToChangeToCode,
            currency,
            taxRate,
            groupPlanToChangeToSize,
            groupPlanToChangeToUsage,
            i18n.language
          )
        } catch (e) {
          debugConsole.error(e)
          setGroupPlanToChangeToPriceError(true)
        }
        setQueryingGroupPlanToChangeToPrice(false)
        setGroupPlanToChangeToPrice(priceData)
      }
      fetchGroupDisplayPrice()
    }
  }, [
    groupPlanToChangeToUsage,
    groupPlanToChangeToSize,
    personalSubscription,
    groupPlanToChangeToCode,
    i18n.language,
  ])

  const updateManagedInstitution = useCallback(
    (institution: ManagedInstitution) => {
      setManagedInstitutions(institutions => {
        return [
          ...(institutions || []).map(i =>
            i.v1Id === institution.v1Id ? institution : i
          ),
        ]
      })
    },
    []
  )

  const handleCloseModal = useCallback(() => {
    setModalIdShown(undefined)
    setPlanCodeToChangeTo(undefined)
  }, [setModalIdShown, setPlanCodeToChangeTo])

  const handleOpenModal = useCallback(
    (id, planCode) => {
      setModalIdShown(id)
      setPlanCodeToChangeTo(planCode)
    },
    [setModalIdShown, setPlanCodeToChangeTo]
  )

  const value = useMemo<SubscriptionDashboardContextValue>(
    () => ({
      groupPlanToChangeToCode,
      groupPlanToChangeToPrice,
      groupPlanToChangeToPriceError,
      groupPlanToChangeToSize,
      groupPlanToChangeToUsage,
      handleCloseModal,
      handleOpenModal,
      hasDisplayedSubscription,
      hasValidActiveSubscription,
      institutionMemberships,
      managedGroupSubscriptions,
      memberGroupSubscriptions,
      managedInstitutions,
      managedPublishers,
      updateManagedInstitution,
      modalIdShown,
      personalSubscription,
      hasSubscription,
      plans,
      planCodeToChangeTo,
      queryingGroupPlanToChangeToPrice,
      queryingIndividualPlansData,
      recurlyLoadError,
      setGroupPlanToChangeToCode,
      setGroupPlanToChangeToSize,
      setGroupPlanToChangeToUsage,
      setModalIdShown,
      setPlanCodeToChangeTo,
      setRecurlyLoadError,
      showCancellation,
      setShowCancellation,
      leavingGroupId,
      setLeavingGroupId,
      userCanExtendTrial,
      getFormattedRenewalDate,
    }),
    [
      groupPlanToChangeToCode,
      groupPlanToChangeToPrice,
      groupPlanToChangeToPriceError,
      groupPlanToChangeToSize,
      groupPlanToChangeToUsage,
      handleCloseModal,
      handleOpenModal,
      hasDisplayedSubscription,
      hasValidActiveSubscription,
      institutionMemberships,
      managedGroupSubscriptions,
      memberGroupSubscriptions,
      managedInstitutions,
      managedPublishers,
      updateManagedInstitution,
      modalIdShown,
      personalSubscription,
      hasSubscription,
      plans,
      planCodeToChangeTo,
      queryingGroupPlanToChangeToPrice,
      queryingIndividualPlansData,
      recurlyLoadError,
      setGroupPlanToChangeToCode,
      setGroupPlanToChangeToSize,
      setGroupPlanToChangeToUsage,
      setModalIdShown,
      setPlanCodeToChangeTo,
      setRecurlyLoadError,
      showCancellation,
      setShowCancellation,
      leavingGroupId,
      setLeavingGroupId,
      userCanExtendTrial,
      getFormattedRenewalDate,
    ]
  )

  return (
    <SubscriptionDashboardContext.Provider value={value}>
      {children}
    </SubscriptionDashboardContext.Provider>
  )
}

export function useSubscriptionDashboardContext() {
  const context = useContext(SubscriptionDashboardContext)
  if (!context) {
    throw new Error(
      'SubscriptionDashboardContext is only available inside SubscriptionDashboardProvider'
    )
  }
  return context
}
