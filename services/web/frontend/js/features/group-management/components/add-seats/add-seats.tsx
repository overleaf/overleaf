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
import { MergeAndOverride, Nullable } from '../../../../../../types/utils'
import { sendMB } from '../../../../infrastructure/event-tracking'

export const MAX_NUMBER_OF_USERS = 50

type CostSummaryData = MergeAndOverride<
  SubscriptionChangePreview,
  { change: AddOnUpdate }
>

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
    isError: isErrorCostSummary,
    runAsync: runAsyncCostSummary,
    data: costSummaryData,
    reset: resetCostSummaryData,
  } = useAsync<CostSummaryData>()
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

  const debouncedTrackUserEnterSeatNumberEvent = useMemo(
    () =>
      debounce((value: number) => {
        sendMB('flex-add-users-form', {
          action: 'enter-seat-number',
          seatNumber: value,
        })
      }, 500),
    []
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
      debouncedTrackUserEnterSeatNumberEvent(seats)

      if (seats > MAX_NUMBER_OF_USERS) {
        debouncedCostSummaryRequest.cancel()
        shouldContactSales = true
      } else {
        debouncedCostSummaryRequest(seats, controller.signal)
      }
    } else {
      debouncedTrackUserEnterSeatNumberEvent.cancel()
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
      sendMB('flex-add-users-form', {
        action: 'click-send-request-button',
      })
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
      sendMB('flex-add-users-form', {
        action: 'click-add-user-button',
      })
      const post = postJSON('/user/subscription/group/add-users/create', {
        signal: addSeatsSignal,
        body: { adding: Number(rawSeats) },
      })
      runAsyncAddSeats(post)
        .then(() => {
          sendMB('flex-add-users-success')
        })
        .catch(() => {
          debugConsole.error()
          sendMB('flex-add-users-error')
        })
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
                      components={[
                        // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
                        <a
                          href="/contact"
                          onClick={() => {
                            sendMB('flex-add-users-form', {
                              action: 'click-contact-customer-support-link',
                            })
                          }}
                        />,
                      ]}
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
                <CostSummarySection
                  isLoadingCostSummary={isLoadingCostSummary}
                  isErrorCostSummary={isErrorCostSummary}
                  shouldContactSales={shouldContactSales}
                  costSummaryData={costSummaryData}
                  totalLicenses={totalLicenses}
                />
                <div className="d-flex align-items-center justify-content-end gap-2">
                  {!isProfessional && (
                    <a
                      href="/user/subscription/group/upgrade-subscription"
                      rel="noreferrer noopener"
                      className="me-auto"
                      onClick={() => {
                        sendMB('flex-upgrade')
                      }}
                    >
                      {t('upgrade_my_plan')}
                    </a>
                  )}
                  <Button
                    variant="secondary"
                    href="/user/subscription"
                    onClick={() =>
                      sendMB('flex-add-users-form', {
                        action: 'click-cancel-button',
                      })
                    }
                  >
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

type CostSummarySectionProps = {
  isLoadingCostSummary: boolean
  isErrorCostSummary: boolean
  shouldContactSales: boolean
  costSummaryData: Nullable<CostSummaryData>
  totalLicenses: number
}

function CostSummarySection({
  isLoadingCostSummary,
  isErrorCostSummary,
  shouldContactSales,
  costSummaryData,
  totalLicenses,
}: CostSummarySectionProps) {
  const { t } = useTranslation()

  if (isLoadingCostSummary) {
    return <LoadingSpinner className="ms-auto me-auto" />
  }

  if (shouldContactSales) {
    return (
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
    )
  }

  if (isErrorCostSummary) {
    return (
      <Notification type="error" content={t('generic_something_went_wrong')} />
    )
  }

  return (
    <CostSummary
      subscriptionChange={costSummaryData}
      totalLicenses={totalLicenses}
    />
  )
}

export default withErrorBoundary(AddSeats)
