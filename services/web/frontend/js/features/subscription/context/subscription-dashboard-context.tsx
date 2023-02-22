import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
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
import { Institution as ManagedInstitution } from '../components/dashboard/managed-institutions'
import { Publisher as ManagedPublisher } from '../components/dashboard/managed-publishers'
import getMeta from '../../../utils/meta'
import {
  loadDisplayPriceWithTaxPromise,
  loadGroupDisplayPriceWithTaxPromise,
} from '../util/recurly-pricing'
import { isRecurlyLoaded } from '../util/is-recurly-loaded'
import { SubscriptionDashModalIds } from '../../../../../types/subscription/dashboard/modal-ids'

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
  institutionMemberships?: Institution[]
  managedGroupSubscriptions: ManagedGroupSubscription[]
  memberGroupSubscriptions: MemberGroupSubscription[]
  managedInstitutions: ManagedInstitution[]
  managedPublishers: ManagedPublisher[]
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
  showChangePersonalPlan: boolean
  setShowChangePersonalPlan: React.Dispatch<React.SetStateAction<boolean>>
  leavingGroupId?: string
  setLeavingGroupId: React.Dispatch<React.SetStateAction<string | undefined>>
}

export const SubscriptionDashboardContext = createContext<
  SubscriptionDashboardContextValue | undefined
>(undefined)

export function SubscriptionDashboardProvider({
  children,
}: {
  children: ReactNode
}) {
  const [modalIdShown, setModalIdShown] = useState<
    SubscriptionDashModalIds | undefined
  >()
  const [recurlyLoadError, setRecurlyLoadError] = useState(false)
  const [showCancellation, setShowCancellation] = useState(false)
  const [showChangePersonalPlan, setShowChangePersonalPlan] = useState(false)
  const [plans, setPlans] = useState([])
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
  const institutionMemberships: Institution[] = getMeta(
    'ol-currentInstitutionsWithLicence'
  )
  const personalSubscription = getMeta('ol-subscription')
  const managedGroupSubscriptions: ManagedGroupSubscription[] = getMeta(
    'ol-managedGroupSubscriptions'
  )
  const memberGroupSubscriptions: MemberGroupSubscription[] = getMeta(
    'ol-memberGroupSubscriptions'
  )
  const [managedInstitutions, setManagedInstitutions] = useState<
    ManagedInstitution[]
  >(getMeta('ol-managedInstitutions'))
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
              taxRate
            )
            if (priceData?.totalForDisplay) {
              plan.displayPrice = priceData.totalForDisplay
            }
          } catch (error) {
            console.error(error)
          }
        }
        setPlans(plansWithoutDisplayPrice)
        setQueryingIndividualPlansData(false)
      }
      fetchPlansDisplayPrices().catch(console.error)
    }
  }, [personalSubscription, plansWithoutDisplayPrice])

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
            groupPlanToChangeToUsage
          )
        } catch (e) {
          console.error(e)
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
      showChangePersonalPlan,
      setShowChangePersonalPlan,
      leavingGroupId,
      setLeavingGroupId,
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
      showChangePersonalPlan,
      setShowChangePersonalPlan,
      leavingGroupId,
      setLeavingGroupId,
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
