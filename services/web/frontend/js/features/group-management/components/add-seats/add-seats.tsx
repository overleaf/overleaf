import { useState, useEffect, useMemo, useRef } from 'react'
import { debounce } from 'lodash'
import { Trans, useTranslation } from 'react-i18next'
import withErrorBoundary from '@/infrastructure/error-boundary'
import useAbortController from '@/shared/hooks/use-abort-controller'
import LoadingSpinner from '@/shared/components/loading-spinner'
import Notification from '@/shared/components/notification'
import IconButton from '@/features/ui/components/bootstrap-5/icon-button'
import {
  Card,
  Row,
  Col,
  FormGroup,
  FormLabel,
  FormControl,
} from 'react-bootstrap-5'
import FormText from '@/features/ui/components/bootstrap-5/form/form-text'
import Button from '@/features/ui/components/bootstrap-5/button'
import CostSummary from '@/features/group-management/components/add-seats/cost-summary'
import RequestStatus from '@/features/group-management/components/request-status'
import useAsync from '@/shared/hooks/use-async'
import getMeta from '@/utils/meta'
import { postJSON } from '@/infrastructure/fetch-json'
import { debugConsole } from '@/utils/debugging'
import * as yup from 'yup'
import {
  AddOnUpdate,
  SubscriptionChangePreview,
} from '../../../../../../types/subscription/subscription-change-preview'
import { MergeAndOverride } from '../../../../../../types/utils'

export const MAX_NUMBER_OF_USERS = 50

function AddSeats() {
  const { t } = useTranslation()
  const groupName = getMeta('ol-groupName')
  const subscriptionId = getMeta('ol-subscriptionId')
  const totalLicenses = Number(getMeta('ol-totalLicenses'))
  const isProfessional = getMeta('ol-isProfessional')
  const [addSeatsInputError, setAddSeatsInputError] = useState<string>()
  const [shouldContactSales, setShouldContactSales] = useState(false)
  const controller = useAbortController()
  const { signal: addSeatsSignal } = useAbortController()
  const { signal: contactSalesSignal } = useAbortController()
  const {
    isLoading: isLoadingCostSummary,
    runAsync: runAsyncCostSummary,
    data: costSummaryData,
    reset: resetCostSummaryData,
  } = useAsync<
    MergeAndOverride<SubscriptionChangePreview, { change: AddOnUpdate }>
  >()
  const {
    isLoading: isAddingSeats,
    isError: isErrorAddingSeats,
    isSuccess: isSuccessAddingSeats,
    runAsync: runAsyncAddSeats,
    data: addedSeatsData,
  } = useAsync<{ adding: number }>()
  const {
    isLoading: isSendingMailToSales,
    isError: isErrorSendingMailToSales,
    isSuccess: isSuccessSendingMailToSales,
    runAsync: runAsyncSendMailToSales,
  } = useAsync()

  const addSeatsValidationSchema = useMemo(() => {
    return yup
      .number()
      .typeError(t('value_must_be_a_number'))
      .integer(t('value_must_be_a_whole_number'))
      .min(1, t('value_must_be_at_least_x', { value: 1 }))
      .required(t('this_field_is_required'))
  }, [t])

  const debouncedCostSummaryRequest = useMemo(
    () =>
      debounce((value: number, signal: AbortSignal) => {
        const post = postJSON('/user/subscription/group/add-users/preview', {
          signal,
          body: { adding: value },
        })
        runAsyncCostSummary(post).catch(debugConsole.error)
      }, 500),
    [runAsyncCostSummary]
  )

  const validateSeats = async (value: string | undefined) => {
    try {
      await addSeatsValidationSchema.validate(value)
      setAddSeatsInputError(undefined)

      return true
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        setAddSeatsInputError(error.errors[0])
      } else {
        debugConsole.error(error)
      }

      return false
    }
  }

  const handleSeatsChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value === '' ? undefined : e.target.value
    const isValidSeatsNumber = await validateSeats(value)
    let shouldContactSales = false

    if (isValidSeatsNumber) {
      const seats = Number(value)

      if (seats > MAX_NUMBER_OF_USERS) {
        debouncedCostSummaryRequest.cancel()
        shouldContactSales = true
      } else {
        debouncedCostSummaryRequest(seats, controller.signal)
      }
    } else {
      debouncedCostSummaryRequest.cancel()
    }

    resetCostSummaryData()
    setShouldContactSales(shouldContactSales)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const formData = new FormData(e.currentTarget)
    const rawSeats =
      formData.get('seats') === ''
        ? undefined
        : (formData.get('seats') as string)

    if (!(await validateSeats(rawSeats))) {
      return
    }

    if (shouldContactSales) {
      const post = postJSON(
        '/user/subscription/group/add-users/sales-contact-form',
        {
          signal: contactSalesSignal,
          body: {
            adding: rawSeats,
          },
        }
      )
      runAsyncSendMailToSales(post).catch(debugConsole.error)
    } else {
      const post = postJSON('/user/subscription/group/add-users/create', {
        signal: addSeatsSignal,
        body: { adding: Number(rawSeats) },
      })
      runAsyncAddSeats(post).catch(debugConsole.error)
    }
  }

  useEffect(() => {
    return () => {
      debouncedCostSummaryRequest.cancel()
    }
  }, [debouncedCostSummaryRequest])

  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    const handleUnload = () => formRef.current?.reset()
    window.addEventListener('beforeunload', handleUnload)

    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [])

  if (isErrorAddingSeats || isErrorSendingMailToSales) {
    return (
      <RequestStatus
        variant="danger"
        icon="error"
        title={t('something_went_wrong')}
        content={
          <Trans
            i18nKey="it_looks_like_that_didnt_work_you_can_try_again_or_get_in_touch"
            // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
            components={[<a href="/contact" rel="noreferrer noopener" />]}
          />
        }
      />
    )
  }

  if (isSuccessAddingSeats) {
    return (
      <RequestStatus
        variant="primary"
        icon="check_circle"
        title={t('youve_added_more_users')}
        content={
          <Trans
            i18nKey="youve_added_x_more_users_to_your_subscription_invite_people"
            components={[
              // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
              <a
                href={`/manage/groups/${subscriptionId}/members`}
                rel="noreferrer noopener"
              />,
            ]}
            values={{ users: addedSeatsData?.adding }}
            shouldUnescape
            tOptions={{ interpolation: { escapeValue: true } }}
          />
        }
      />
    )
  }

  if (isSuccessSendingMailToSales) {
    return (
      <RequestStatus
        icon="email"
        title={t('we_got_your_request')}
        content={t('our_team_will_get_back_to_you_shortly')}
      />
    )
  }

  return (
    <div className="container">
      <Row>
        <Col xxl={5} xl={6} lg={7} md={9} className="mx-auto">
          <div className="group-heading" data-testid="group-heading">
            <IconButton
              variant="ghost"
              href="/user/subscription"
              size="lg"
              icon="arrow_back"
              accessibilityLabel={t('back_to_subscription')}
            />
            <h2>{groupName || t('group_subscription')}</h2>
          </div>
          <Card className="card-description-secondary">
            <Card.Body>
              <form
                noValidate
                className="d-grid gap-4"
                onSubmit={handleSubmit}
                ref={formRef}
                data-testid="add-more-users-group-form"
              >
                <div className="d-grid gap-1">
                  <h4 className="fw-bold m-0 card-description-secondary">
                    {t('add_more_users')}
                  </h4>
                  <div>
                    {t('your_current_plan_supports_up_to_x_users', {
                      users: totalLicenses,
                    })}
                  </div>
                  <div>
                    <Trans
                      i18nKey="if_you_want_to_reduce_the_number_of_users_please_contact_support"
                      // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
                      components={[<a href="/contact" />]}
                    />
                  </div>
                </div>
                <div>
                  <FormGroup controlId="number-of-users-input">
                    <FormLabel>
                      {t('how_many_users_do_you_want_to_add')}
                    </FormLabel>
                    <FormControl
                      type="text"
                      required
                      className="w-25"
                      name="seats"
                      disabled={isLoadingCostSummary}
                      onChange={handleSeatsChange}
                      isInvalid={Boolean(addSeatsInputError)}
                    />
                    {Boolean(addSeatsInputError) && (
                      <FormText type="error">{addSeatsInputError}</FormText>
                    )}
                  </FormGroup>
                </div>
                {isLoadingCostSummary ? (
                  <LoadingSpinner className="ms-auto me-auto" />
                ) : shouldContactSales ? (
                  <div>
                    <Notification
                      content={
                        <Trans
                          i18nKey="if_you_want_more_than_x_users_on_your_plan_we_need_to_add_them_for_you"
                          // eslint-disable-next-line react/jsx-key
                          components={[<b />]}
                          values={{ count: 50 }}
                          shouldUnescape
                          tOptions={{ interpolation: { escapeValue: true } }}
                        />
                      }
                      type="info"
                    />
                  </div>
                ) : (
                  <CostSummary
                    subscriptionChange={costSummaryData}
                    totalLicenses={totalLicenses}
                  />
                )}
                <div className="d-flex align-items-center justify-content-end gap-2">
                  {!isProfessional && (
                    <a
                      href="/user/subscription/group/upgrade-subscription"
                      rel="noreferrer noopener"
                      className="me-auto"
                    >
                      {t('upgrade_my_plan')}
                    </a>
                  )}
                  <Button variant="secondary" href="/user/subscription">
                    {t('cancel')}
                  </Button>
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={
                      isAddingSeats ||
                      isLoadingCostSummary ||
                      isSendingMailToSales
                    }
                    isLoading={isAddingSeats || isSendingMailToSales}
                  >
                    {shouldContactSales ? t('send_request') : t('add_users')}
                  </Button>
                </div>
              </form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default withErrorBoundary(AddSeats)
