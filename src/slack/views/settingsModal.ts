/**
 * Settings Modal View
 */

export function buildSettingsModal() {
  return {
    type: 'modal',
    callback_id: 'settings_modal',
    title: {
      type: 'plain_text',
      text: 'Settings',
    },
    submit: {
      type: 'plain_text',
      text: 'Save',
    },
    close: {
      type: 'plain_text',
      text: 'Cancel',
    },
    blocks: [
      // Analysis Settings Section
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📝 Analysis Settings',
          emoji: true,
        },
      },
      {
        type: 'input',
        block_id: 'custom_context_block',
        optional: true,
        element: {
          type: 'plain_text_input',
          action_id: 'custom_context',
          multiline: true,
          placeholder: {
            type: 'plain_text',
            text: 'Example: In our context, a "pain point" is when users express frustration with workflow inefficiency...',
          },
        },
        label: {
          type: 'plain_text',
          text: 'Custom Context',
        },
        hint: {
          type: 'plain_text',
          text: 'Define what you consider as pain points, hidden complaints, etc.',
        },
      },
      {
        type: 'input',
        block_id: 'insight_examples_block',
        optional: true,
        element: {
          type: 'plain_text_input',
          action_id: 'insight_examples',
          multiline: true,
          placeholder: {
            type: 'plain_text',
            text: 'Title: User frustrated with login\nDescription: Customer mentioned difficulty\nType: Pain Point',
          },
        },
        label: {
          type: 'plain_text',
          text: 'Insight Examples',
        },
        hint: {
          type: 'plain_text',
          text: 'Provide examples of insights you want to extract',
        },
      },
      {
        type: 'divider',
      },
      // Import Sources Section
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📥 Import Sources',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Automatically import transcripts from external sources.',
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '➕ Add Import Source',
              emoji: true,
            },
            action_id: 'add_import_source',
            style: 'primary',
          },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '_No import sources configured yet. Add Zoom, Fireflies, or custom API._',
          },
        ],
      },
      {
        type: 'divider',
      },
      // Export Destinations Section
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📤 Export Destinations',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Export insights to Airtable, Linear, Notion, Jira, or Google Sheets.',
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '➕ Add Export Destination',
              emoji: true,
            },
            action_id: 'add_export_destination',
            style: 'primary',
          },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '_No export destinations configured yet. Add Airtable, Linear, Notion, etc._',
          },
        ],
      },
      {
        type: 'divider',
      },
      // Notifications Section
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🔔 Notifications',
          emoji: true,
        },
      },
      {
        type: 'input',
        block_id: 'notify_completion_block',
        optional: true,
        element: {
          type: 'checkboxes',
          action_id: 'notify_completion',
          options: [
            {
              text: {
                type: 'plain_text',
                text: 'Notify when analysis completes',
              },
              value: 'notify_on_completion',
            },
            {
              text: {
                type: 'plain_text',
                text: 'Notify when analysis fails',
              },
              value: 'notify_on_failure',
            },
          ],
          initial_options: [
            {
              text: {
                type: 'plain_text',
                text: 'Notify when analysis completes',
              },
              value: 'notify_on_completion',
            },
          ],
        },
        label: {
          type: 'plain_text',
          text: 'Notification Preferences',
        },
      },
    ],
  };
}
