import { GroupPlans } from '../../../../../types/subscription/dashboard/group-plans'
import { Plan } from '../../../../../types/subscription/plan'

const features = {
  student: {
    collaborators: 6,
    dropbox: true,
    versioning: true,
    github: true,
    templates: true,
    references: true,
    referencesSearch: true,
    gitBridge: true,
    zotero: true,
    mendeley: true,
    compileTimeout: 240,
    compileGroup: 'priority',
    trackChanges: true,
    symbolPalette: true,
  },
  personal: {
    collaborators: 1,
    dropbox: true,
    versioning: true,
    github: true,
    gitBridge: true,
    templates: true,
    references: true,
    referencesSearch: true,
    zotero: true,
    mendeley: true,
    compileTimeout: 240,
    compileGroup: 'priority',
    trackChanges: false,
    symbolPalette: true,
  },
  collaborator: {
    collaborators: 10,
    dropbox: true,
    versioning: true,
    github: true,
    templates: true,
    references: true,
    referencesSearch: true,
    zotero: true,
    gitBridge: true,
    mendeley: true,
    compileTimeout: 240,
    compileGroup: 'priority',
    trackChanges: true,
    symbolPalette: true,
  },
  professional: {
    collaborators: -1,
    dropbox: true,
    versioning: true,
    github: true,
    templates: true,
    references: true,
    referencesSearch: true,
    zotero: true,
    gitBridge: true,
    mendeley: true,
    compileTimeout: 240,
    compileGroup: 'priority',
    trackChanges: true,
    symbolPalette: true,
  },
}

const studentAccounts: Array<Plan> = [
  {
    planCode: 'student',
    name: 'Student',
    price_in_cents: 1000,
    features: features.student,
    featureDescription: [],
  },
  {
    planCode: 'student-annual',
    name: 'Student Annual',
    price_in_cents: 9900,
    annual: true,
    features: features.student,
    featureDescription: [],
  },
  {
    planCode: 'student_free_trial',
    name: 'Student',
    price_in_cents: 800,
    features: features.student,
    hideFromUsers: true,
    featureDescription: [],
  },
  {
    planCode: 'student_free_trial_7_days',
    name: 'Student',
    price_in_cents: 1000,
    features: features.student,
    hideFromUsers: true,
    featureDescription: [],
  },
]

const individualMonthlyPlans: Array<Plan> = [
  {
    planCode: 'paid-personal',
    name: 'Personal',
    price_in_cents: 1500,
    features: features.personal,
    featureDescription: [],
  },
  {
    planCode: 'paid-personal_free_trial_7_days',
    name: 'Personal (Hidden)',
    price_in_cents: 1500,
    features: features.personal,
    featureDescription: [],
    hideFromUsers: true,
  },
  {
    planCode: 'collaborator',
    name: 'Standard (Collaborator)',
    price_in_cents: 2300,
    features: features.collaborator,
    featureDescription: [],
  },
  {
    planCode: 'professional',
    name: 'Professional',
    price_in_cents: 4500,
    features: features.professional,
    featureDescription: [],
  },
  {
    planCode: 'collaborator_free_trial',
    name: 'Standard (Collaborator) (Hidden)',
    price_in_cents: 1900,
    features: features.collaborator,
    hideFromUsers: true,
    featureDescription: [],
  },
  {
    planCode: 'collaborator_free_trial_14_days',
    name: 'Standard (Collaborator) (Hidden)',
    price_in_cents: 1900,
    features: features.collaborator,
    hideFromUsers: true,
    featureDescription: [],
  },
  {
    planCode: 'collaborator_free_trial_7_days',
    name: 'Standard (Collaborator) (Hidden)',
    price_in_cents: 2300,
    features: features.collaborator,
    hideFromUsers: true,
    featureDescription: [],
  },
  {
    planCode: 'collaborator-annual_free_trial',
    name: 'Standard (Collaborator) Annual (Hidden)',
    price_in_cents: 18000,
    features: features.collaborator,
    hideFromUsers: true,
    featureDescription: [],
  },
  {
    planCode: 'professional_free_trial',
    name: 'Professional (Hidden)',
    price_in_cents: 3000,
    features: features.professional,
    hideFromUsers: true,
    featureDescription: [],
  },
  {
    planCode: 'professional_free_trial_7_days',
    name: 'Professional (Hidden)',
    price_in_cents: 4500,
    features: features.professional,
    hideFromUsers: true,
    featureDescription: [],
  },
]

const individualAnnualPlans: Array<Plan> = [
  {
    planCode: 'paid-personal-annual',
    name: 'Personal Annual',
    price_in_cents: 13900,
    annual: true,
    features: features.personal,
    featureDescription: [],
  },
  {
    planCode: 'collaborator-annual',
    name: 'Standard (Collaborator) Annual',
    price_in_cents: 21900,
    annual: true,
    features: features.collaborator,
    featureDescription: [],
  },
  {
    planCode: 'professional-annual',
    name: 'Professional Annual',
    price_in_cents: 42900,
    annual: true,
    features: features.professional,
    featureDescription: [],
  },
]

export const plans = [
  ...studentAccounts,
  ...individualMonthlyPlans,
  ...individualAnnualPlans,
]

export const groupPlans: GroupPlans = {
  plans: [
    {
      display: 'Standard',
      code: 'collaborator',
    },
    {
      display: 'Professional',
      code: 'professional',
    },
  ],
  sizes: ['2', '3', '4', '5', '10', '20'],
}

export const groupPriceByUsageTypeAndSize = {
  educational: {
    professional: {
      EUR: {
        '2': {
          price_in_cents: 51600,
        },
        '3': {
          price_in_cents: 77400,
        },
        '4': {
          price_in_cents: 103200,
        },
        '5': {
          price_in_cents: 129000,
        },
        '10': {
          price_in_cents: 143000,
        },
        '20': {
          price_in_cents: 264000,
        },
      },
      USD: {
        '2': {
          price_in_cents: 55800,
        },
        '3': {
          price_in_cents: 83700,
        },
        '4': {
          price_in_cents: 111600,
        },
        '5': {
          price_in_cents: 139500,
        },
        '10': {
          price_in_cents: 155000,
        },
        '20': {
          price_in_cents: 286000,
        },
      },
    },
    collaborator: {
      EUR: {
        '2': {
          price_in_cents: 25000,
        },
        '3': {
          price_in_cents: 37500,
        },
        '4': {
          price_in_cents: 50000,
        },
        '5': {
          price_in_cents: 62500,
        },
        '10': {
          price_in_cents: 69000,
        },
        '20': {
          price_in_cents: 128000,
        },
      },
      USD: {
        '2': {
          price_in_cents: 27800,
        },
        '3': {
          price_in_cents: 41700,
        },
        '4': {
          price_in_cents: 55600,
        },
        '5': {
          price_in_cents: 69500,
        },
        '10': {
          price_in_cents: 77000,
        },
        '20': {
          price_in_cents: 142000,
        },
      },
    },
  },
  enterprise: {
    professional: {
      EUR: {
        '2': {
          price_in_cents: 51600,
        },
        '3': {
          price_in_cents: 77400,
        },
        '4': {
          price_in_cents: 103200,
        },
        '5': {
          price_in_cents: 129000,
        },
        '10': {
          price_in_cents: 239000,
        },
        '20': {
          price_in_cents: 442000,
        },
      },
      USD: {
        '2': {
          price_in_cents: 55800,
        },
        '3': {
          price_in_cents: 83700,
        },
        '4': {
          price_in_cents: 111600,
        },
        '5': {
          price_in_cents: 139500,
        },
        '10': {
          price_in_cents: 259000,
        },
        '20': {
          price_in_cents: 478000,
        },
      },
    },
    collaborator: {
      EUR: {
        '2': {
          price_in_cents: 25000,
        },
        '3': {
          price_in_cents: 37500,
        },
        '4': {
          price_in_cents: 50000,
        },
        '5': {
          price_in_cents: 62500,
        },
        '10': {
          price_in_cents: 116000,
        },
        '20': {
          price_in_cents: 214000,
        },
      },
      USD: {
        '2': {
          price_in_cents: 27800,
        },
        '3': {
          price_in_cents: 41700,
        },
        '4': {
          price_in_cents: 55600,
        },
        '5': {
          price_in_cents: 69500,
        },
        '10': {
          price_in_cents: 129000,
        },
        '20': {
          price_in_cents: 238000,
        },
      },
    },
  },
}
