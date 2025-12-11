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
            text: 'Example: Focus on workflow efficiency issues. A "pain point" means user frustration with task completion time...',
          },
        },
        label: {
          type: 'plain_text',
          text: 'System Instructions',
        },
        hint: {
          type: 'plain_text',
          text: 'Guide the AI on what to look for in transcripts. Define pain points, complaints, opportunities, etc. Leave empty to use default analysis.',
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
    ],
  };
}
