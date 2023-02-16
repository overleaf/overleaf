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
  ManagedGroupSubscription,
  Subscription,
} from '../../../../../types/subscription/dashboard/subscription'
import { Plan } from '../../../../../types/subscription/plan'
import { Institution as ManagedInstitution } from '../components/dashboard/managed-institutions'
import { Institution } from '../../../../../types/institution'
import getMeta from '../../../utils/meta'
import { loadDisplayPriceWithTaxPromise } from '../util/recurly-pricing'
import { isRecurlyLoaded } from '../util/is-recurly-loaded'

type SubscriptionDashboardContextValue = {
  handleCloseModal: () => void
  handleOpenModal: (modalIdToOpen: string, planCode?: string) => void
  hasDisplayedSubscription: boolean
  institutionMemberships?: Institution[]
  managedGroupSubscriptions: ManagedGroupSubscription[]
  managedInstitutions: ManagedInstitution[]
  updateManagedInstitution: (institution: ManagedInstitution) => void
  modalIdShown?: string
  personalSubscription?: Subscription
  plans: Plan[]
  planCodeToChangeTo?: string
  queryingIndividualPlansData: boolean
  recurlyLoadError: boolean
  setModalIdShown: React.Dispatch<React.SetStateAction<string | undefined>>
  setPlanCodeToChangeTo: React.Dispatch<
    React.SetStateAction<string | undefined>
  >
  setRecurlyLoadError: React.Dispatch<React.SetStateAction<boolean>>
  showCancellation: boolean
  setShowCancellation: React.Dispatch<React.SetStateAction<boolean>>
  showChangePersonalPlan: boolean
  setShowChangePersonalPlan: React.Dispatch<React.SetStateAction<boolean>>
}

export const SubscriptionDashboardContext = createContext<
  SubscriptionDashboardContextValue | undefined
>(undefined)

export function SubscriptionDashboardProvider({
  children,
}: {
  children: ReactNode
}) {
  const [modalIdShown, setModalIdShown] = useState<string | undefined>()
  const [recurlyLoadError, setRecurlyLoadError] = useState(false)
  const [showCancellation, setShowCancellation] = useState(false)
  const [showChangePersonalPlan, setShowChangePersonalPlan] = useState(false)
  const [plans, setPlans] = useState([])
  const [queryingIndividualPlansData, setQueryingIndividualPlansData] =
    useState(true)
  const [planCodeToChangeTo, setPlanCodeToChangeTo] = useState<
    string | undefined
  >()

  const plansWithoutDisplayPrice = getMeta('ol-plans')
  const institutionMemberships = getMeta('ol-currentInstitutionsWithLicence')
  const personalSubscription = getMeta('ol-subscription')
  const managedGroupSubscriptions = getMeta('ol-managedGroupSubscriptions')
  const [managedInstitutions, setManagedInstitutions] = useState<
    ManagedInstitution[]
  >(getMeta('ol-managedInstitutions'))
  const recurlyApiKey = getMeta('ol-recurlyApiKey')

  const hasDisplayedSubscription =
    institutionMemberships?.length > 0 ||
    personalSubscription ||
    managedGroupSubscriptions?.length > 0 ||
    managedInstitutions?.length > 0

  useEffect(() => {
    if (!isRecurlyLoaded()) {
      setRecurlyLoadError(true)
    } else if (recurlyApiKey) {
      recurly.configure(recurlyApiKey)
    }
  }, [recurlyApiKey, setRecurlyLoadError])

  useEffect(() => {
    if (isRecurlyLoaded() && plansWithoutDisplayPrice && personalSubscription) {
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
    setModalIdShown('')
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
      handleCloseModal,
      handleOpenModal,
      hasDisplayedSubscription,
      institutionMemberships,
      managedGroupSubscriptions,
      managedInstitutions,
      updateManagedInstitution,
      modalIdShown,
      personalSubscription,
      plans,
      planCodeToChangeTo,
      queryingIndividualPlansData,
      recurlyLoadError,
      setModalIdShown,
      setPlanCodeToChangeTo,
      setRecurlyLoadError,
      showCancellation,
      setShowCancellation,
      showChangePersonalPlan,
      setShowChangePersonalPlan,
    }),
    [
      handleCloseModal,
      handleOpenModal,
      hasDisplayedSubscription,
      institutionMemberships,
      managedGroupSubscriptions,
      managedInstitutions,
      updateManagedInstitution,
      modalIdShown,
      personalSubscription,
      plans,
      planCodeToChangeTo,
      queryingIndividualPlansData,
      recurlyLoadError,
      setModalIdShown,
      setPlanCodeToChangeTo,
      setRecurlyLoadError,
      showCancellation,
      setShowCancellation,
      showChangePersonalPlan,
      setShowChangePersonalPlan,
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
