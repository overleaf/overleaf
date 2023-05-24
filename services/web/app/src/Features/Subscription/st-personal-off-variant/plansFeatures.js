const individualPlans = [
  {
    divider: false,
    items: [
      {
        feature: 'number_of_users',
        info: 'number_of_users_info',
        value: 'str',
        plans: {
          free: '1 user',
          collaborator: '1 user',
          professional: '1 user',
        },
      },
      {
        feature: 'max_collab_per_project',
        info: 'max_collab_per_project_info',
        value: 'richText',
        plans: {
          free: 'You + 1',
          collaborator: 'You + 10',
          professional: '<b>Unlimited</b>',
        },
      },
    ],
  },
  {
    divider: true,
    dividerLabel: 'you_and_collaborators_get_access_to',
    dividerInfo: 'you_and_collaborators_get_access_to_info',
    items: [
      {
        feature: 'compile_timeout_short',
        info: 'compile_timeout_short_info',
        value: 'str',
        plans: {
          free: '1 minute',
          collaborator: '4 minutes',
          professional: '4 minutes',
        },
      },
      {
        feature: 'realtime_track_changes',
        info: 'realtime_track_changes_info_v2',
        value: 'bool',
        plans: {
          free: false,
          collaborator: true,
          professional: true,
        },
      },
      {
        feature: 'full_doc_history',
        info: 'full_doc_history_info_v2',
        value: 'bool',
        plans: {
          free: false,
          collaborator: true,
          professional: true,
        },
      },
      {
        feature: 'reference_search',
        info: 'reference_search_info_v2',
        value: 'bool',
        plans: {
          free: false,
          collaborator: true,
          professional: true,
        },
      },
      {
        feature: 'git_integration_lowercase',
        info: 'git_integration_lowercase_info',
        value: 'bool',
        plans: {
          free: false,
          collaborator: true,
          professional: true,
        },
      },
    ],
  },
  {
    divider: true,
    dividerLabel: 'you_get_access_to',
    dividerInfo: 'you_get_access_to_info',
    items: [
      {
        feature: 'powerful_latex_editor_and_realtime_collaboration',
        info: 'powerful_latex_editor_and_realtime_collaboration_info',
        value: 'bool',
        plans: {
          free: true,
          collaborator: true,
          professional: true,
        },
      },
      {
        feature: 'unlimited_projects',
        info: 'unlimited_projects_info',
        value: 'bool',
        plans: {
          free: true,
          collaborator: true,
          professional: true,
        },
      },
      {
        feature: 'thousands_templates',
        info: 'hundreds_templates_info',
        value: 'bool',
        plans: {
          free: true,
          collaborator: true,
          professional: true,
        },
      },
      {
        feature: 'symbol_palette',
        info: 'symbol_palette_info',
        value: 'bool',
        plans: {
          free: false,
          collaborator: true,
          professional: true,
        },
      },
      {
        feature: 'github_only_integration_lowercase',
        info: 'github_only_integration_lowercase_info',
        value: 'bool',
        plans: {
          free: false,
          collaborator: true,
          professional: true,
        },
      },
      {
        feature: 'dropbox_integration_lowercase',
        info: 'dropbox_integration_info',
        value: 'bool',
        plans: {
          free: false,
          collaborator: true,
          professional: true,
        },
      },
      {
        feature: 'mendeley_integration_lowercase',
        info: 'mendeley_integration_lowercase_info',
        value: 'bool',
        plans: {
          free: false,
          collaborator: true,
          professional: true,
        },
      },
      {
        feature: 'zotero_integration_lowercase',
        info: 'zotero_integration_lowercase_info',
        value: 'bool',
        plans: {
          free: false,
          collaborator: true,
          professional: true,
        },
      },
      {
        feature: 'priority_support',
        info: 'priority_support_info',
        value: 'bool',
        plans: {
          free: false,
          collaborator: true,
          professional: true,
        },
      },
    ],
  },
]

const groupPlans = [
  {
    divider: false,
    items: [
      {
        feature: 'number_of_users',
        info: 'number_of_users_info',
        value: 'str',
        plans: {
          group_standard: '2 users',
          group_professional: '2 users',
          organization: 'Contact sales',
        },
      },
      {
        feature: 'max_collab_per_project',
        info: 'max_collab_per_project_info',
        value: 'richText',
        plans: {
          group_standard: 'Project author + 10',
          group_professional: '<b>Unlimited</b>',
          organization: '<b>Unlimited</b>',
        },
      },
    ],
  },
  {
    divider: true,
    dividerLabel: 'group_admins_get_access_to',
    dividerInfo: 'group_admins_get_access_to_info',
    items: [
      {
        feature: 'user_management',
        info: 'user_management_info',
        value: 'str',
        plans: {
          group_standard: 'admin panel',
          group_professional: 'admin panel',
          organization: 'automatic user registration',
        },
      },
      {
        feature: 'usage_metrics',
        info: 'usage_metrics_info',
        value: 'bool',
        plans: {
          group_standard: true,
          group_professional: true,
          organization: true,
        },
      },
      {
        feature: 'sso_integration',
        info: 'sso_integration_info',
        value: 'bool',
        plans: {
          group_standard: false,
          group_professional: false,
          organization: true,
        },
      },
      {
        feature: 'sitewide_option_available',
        info: 'sitewide_option_available_info',
        value: 'bool',
        plans: {
          group_standard: false,
          group_professional: false,
          organization: true,
        },
      },
      {
        feature: 'custom_resource_portal',
        info: 'custom_resource_portal_info',
        value: 'bool',
        plans: {
          group_standard: false,
          group_professional: false,
          organization: true,
        },
      },
      {
        feature: 'personalized_onboarding',
        info: 'personalized_onboarding_info',
        value: 'bool',
        plans: {
          group_standard: false,
          group_professional: false,
          organization: true,
        },
      },
      {
        feature: 'dedicated_account_manager',
        info: 'dedicated_account_manager_info',
        value: 'bool',
        plans: {
          group_standard: false,
          group_professional: false,
          organization: true,
        },
      },
    ],
  },
  {
    divider: true,
    dividerLabel: 'group_members_and_collaborators_get_access_to',
    dividerInfo: 'group_members_and_collaborators_get_access_to_info',
    items: [
      {
        feature: 'compile_timeout_short',
        info: 'compile_timeout_short_info',
        value: 'str',
        plans: {
          group_standard: '4 minutes',
          group_professional: '4 minutes',
          organization: '4 minutes',
        },
      },
      {
        feature: 'realtime_track_changes',
        info: 'realtime_track_changes_info_v2',
        value: 'bool',
        plans: {
          group_standard: true,
          group_professional: true,
          organization: true,
        },
      },
      {
        feature: 'full_doc_history',
        info: 'full_doc_history_info_v2',
        value: 'bool',
        plans: {
          group_standard: true,
          group_professional: true,
          organization: true,
        },
      },
      {
        feature: 'reference_search',
        info: 'reference_search_info_v2',
        value: 'bool',
        plans: {
          group_standard: true,
          group_professional: true,
          organization: true,
        },
      },
      {
        feature: 'git_integration_lowercase',
        info: 'git_integration_lowercase_info',
        value: 'bool',
        plans: {
          group_standard: true,
          group_professional: true,
          organization: true,
        },
      },
    ],
  },
  {
    divider: true,
    dividerLabel: 'group_members_get_access_to',
    dividerInfo: 'group_members_get_access_to_info',
    items: [
      {
        feature: 'powerful_latex_editor_and_realtime_collaboration',
        info: 'powerful_latex_editor_and_realtime_collaboration_info',
        value: 'bool',
        plans: {
          group_standard: true,
          group_professional: true,
          organization: true,
        },
      },
      {
        feature: 'unlimited_projects',
        info: 'unlimited_projects_info',
        value: 'bool',
        plans: {
          group_standard: true,
          group_professional: true,
          organization: true,
        },
      },
      {
        feature: 'thousands_templates',
        info: 'hundreds_templates_info',
        value: 'bool',
        plans: {
          group_standard: true,
          group_professional: true,
          organization: true,
        },
      },
      {
        feature: 'symbol_palette',
        info: 'symbol_palette_info',
        value: 'bool',
        plans: {
          group_standard: true,
          group_professional: true,
          organization: true,
        },
      },
      {
        feature: 'github_only_integration_lowercase',
        info: 'github_only_integration_lowercase_info',
        value: 'bool',
        plans: {
          group_standard: true,
          group_professional: true,
          organization: true,
        },
      },
      {
        feature: 'dropbox_integration_lowercase',
        info: 'dropbox_integration_info',
        value: 'bool',
        plans: {
          group_standard: true,
          group_professional: true,
          organization: true,
        },
      },
      {
        feature: 'mendeley_integration_lowercase',
        info: 'mendeley_integration_lowercase_info',
        value: 'bool',
        plans: {
          group_standard: true,
          group_professional: true,
          organization: true,
        },
      },
      {
        feature: 'zotero_integration_lowercase',
        info: 'zotero_integration_lowercase_info',
        value: 'bool',
        plans: {
          group_standard: true,
          group_professional: true,
          organization: true,
        },
      },
      {
        feature: 'priority_support',
        info: 'priority_support_info',
        value: 'bool',
        plans: {
          group_standard: true,
          group_professional: true,
          organization: true,
        },
      },
    ],
  },
]

const studentPlans = [
  {
    divider: false,
    items: [
      {
        feature: 'number_of_users',
        info: 'number_of_users_info',
        value: 'str',
        plans: {
          free: '1 user',
          student: '1 user',
        },
      },
      {
        feature: 'max_collab_per_project',
        info: 'max_collab_per_project_info',
        value: 'str',
        plans: {
          free: 'You + 1',
          student: 'You + 6',
        },
      },
    ],
  },
  {
    divider: true,
    dividerLabel: 'you_and_collaborators_get_access_to',
    dividerInfo: 'you_and_collaborators_get_access_to_info',
    items: [
      {
        feature: 'compile_timeout_short',
        info: 'compile_timeout_short_info',
        value: 'str',
        plans: {
          free: '1 minute',
          student: '4 minutes',
        },
      },
      {
        feature: 'realtime_track_changes',
        info: 'realtime_track_changes_info_v2',
        value: 'bool',
        plans: {
          free: false,
          student: true,
        },
      },
      {
        feature: 'full_doc_history',
        info: 'full_doc_history_info_v2',
        value: 'bool',
        plans: {
          free: false,
          student: true,
        },
      },
      {
        feature: 'reference_search',
        info: 'reference_search_info_v2',
        value: 'bool',
        plans: {
          free: false,
          student: true,
        },
      },
      {
        feature: 'git_integration_lowercase',
        info: 'git_integration_lowercase_info',
        value: 'bool',
        plans: {
          free: false,
          student: true,
        },
      },
    ],
  },
  {
    divider: true,
    dividerLabel: 'you_get_access_to',
    dividerInfo: 'you_get_access_to_info',
    items: [
      {
        feature: 'powerful_latex_editor_and_realtime_collaboration',
        info: 'powerful_latex_editor_and_realtime_collaboration_info',
        value: 'bool',
        plans: {
          free: true,
          student: true,
        },
      },
      {
        feature: 'unlimited_projects',
        info: 'unlimited_projects_info',
        value: 'bool',
        plans: {
          free: true,
          student: true,
        },
      },
      {
        feature: 'thousands_templates',
        info: 'thousands_templates_info',
        value: 'bool',
        plans: {
          free: true,
          student: true,
        },
      },
      {
        feature: 'symbol_palette',
        info: 'symbol_palette_info',
        value: 'bool',
        plans: {
          free: false,
          student: true,
        },
      },
      {
        feature: 'github_only_integration_lowercase',
        info: 'github_only_integration_lowercase_info',
        value: 'bool',
        plans: {
          free: false,
          student: true,
        },
      },
      {
        feature: 'dropbox_integration_lowercase',
        info: 'dropbox_integration_info',
        value: 'bool',
        plans: {
          free: false,
          student: true,
        },
      },
      {
        feature: 'mendeley_integration_lowercase',
        info: 'mendeley_integration_lowercase_info',
        value: 'bool',
        plans: {
          free: false,
          student: true,
        },
      },
      {
        feature: 'zotero_integration_lowercase',
        info: 'zotero_integration_lowercase_info',
        value: 'bool',
        plans: {
          free: false,
          student: true,
        },
      },
      {
        feature: 'priority_support',
        info: 'priority_support_info',
        value: 'bool',
        plans: {
          free: false,
          student: true,
        },
      },
    ],
  },
]

module.exports = {
  individual: individualPlans,
  group: groupPlans,
  student: studentPlans,
}
