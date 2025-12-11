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
    close: {
      type: 'plain_text',
      text: 'Close',
    },
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '⚙️ MeetyAI Settings',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Custom Context & Examples*\nDefine what you consider as pain points, hidden complaints, and provide examples of insights you want to extract.',
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
            text: 'Example:\nTitle: User frustrated with login process\nDescription: Customer mentioned difficulty remembering password\nType: Pain Point',
          },
        },
        label: {
          type: 'plain_text',
          text: 'Insight Examples',
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Notifications*',
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
                text: 'Notify when transcript analysis completes',
              },
              value: 'notify_on_completion',
            },
          ],
          initial_options: [
            {
              text: {
                type: 'plain_text',
                text: 'Notify when transcript analysis completes',
              },
              value: 'notify_on_completion',
            },
          ],
        },
        label: {
          type: 'plain_text',
          text: 'Completion Notifications',
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '💡 _More settings coming soon: AI models, Import sources, Export destinations_',
          },
        ],
      },
    ],
  };
}
