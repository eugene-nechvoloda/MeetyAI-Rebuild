/**
 * Export Configuration Modals
 */

export function buildExportProviderSelectionModal() {
  return {
    type: 'modal',
    callback_id: 'select_export_provider',
    title: { type: 'plain_text', text: 'Add Export Destination' },
    submit: { type: 'plain_text', text: 'Next' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Choose where to export your insights:*',
        },
      },
      {
        type: 'input',
        block_id: 'provider_block',
        element: {
          type: 'static_select',
          action_id: 'provider_select',
          placeholder: { type: 'plain_text', text: 'Select a provider' },
          options: [
            {
              text: { type: 'plain_text', text: '🗄️  Airtable' },
              value: 'airtable',
            },
            {
              text: { type: 'plain_text', text: '📋 Linear' },
              value: 'linear',
            },
            {
              text: { type: 'plain_text', text: '📝 Notion' },
              value: 'notion',
            },
            {
              text: { type: 'plain_text', text: '🎯 Jira' },
              value: 'jira',
            },
            {
              text: { type: 'plain_text', text: '📊 Google Sheets' },
              value: 'google_sheets',
            },
          ],
        },
        label: { type: 'plain_text', text: 'Provider' },
      },
    ],
  };
}

export function buildAirtableConfigModal() {
  return {
    type: 'modal',
    callback_id: 'configure_airtable_export',
    title: { type: 'plain_text', text: 'Configure Airtable' },
    submit: { type: 'plain_text', text: 'Next: Map Fields' },
    close: { type: 'plain_text', text: 'Back' },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Airtable Configuration*\n\nConnect your Airtable base to export insights automatically.',
        },
      },
      {
        type: 'input',
        block_id: 'label_block',
        element: {
          type: 'plain_text_input',
          action_id: 'label_input',
          placeholder: { type: 'plain_text', text: 'e.g., Product Insights' },
        },
        label: { type: 'plain_text', text: 'Label' },
        hint: { type: 'plain_text', text: 'A friendly name for this export destination' },
      },
      {
        type: 'input',
        block_id: 'api_key_block',
        element: {
          type: 'plain_text_input',
          action_id: 'api_key_input',
          placeholder: { type: 'plain_text', text: 'patAbCd1234567890.abcdefghijklmnop' },
        },
        label: { type: 'plain_text', text: 'API Key' },
        hint: {
          type: 'plain_text',
          text: 'Get from: https://airtable.com/create/tokens',
        },
      },
      {
        type: 'input',
        block_id: 'base_id_block',
        element: {
          type: 'plain_text_input',
          action_id: 'base_id_input',
          placeholder: { type: 'plain_text', text: 'appXXXXXXXXXXXXXX' },
        },
        label: { type: 'plain_text', text: 'Base ID' },
        hint: {
          type: 'plain_text',
          text: 'Found in your Airtable base URL',
        },
      },
      {
        type: 'input',
        block_id: 'table_name_block',
        element: {
          type: 'plain_text_input',
          action_id: 'table_name_input',
          placeholder: { type: 'plain_text', text: 'Insights' },
        },
        label: { type: 'plain_text', text: 'Table Name' },
        hint: {
          type: 'plain_text',
          text: 'The exact name of your Airtable table',
        },
      },
    ],
  };
}

export function buildFieldMappingModal(provider: string, sourceFields: any[], destinationFields: any[], configId?: string) {
  return {
    type: 'modal',
    callback_id: 'map_export_fields',
    title: { type: 'plain_text', text: 'Map Fields' },
    submit: { type: 'plain_text', text: 'Save & Test' },
    close: { type: 'plain_text', text: 'Back' },
    private_metadata: configId || provider,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Field Mapping for ${provider}*\n\nMap MeetyAI insight fields to your ${provider} fields:`,
        },
      },
      {
        type: 'divider',
      },
      // Title mapping
      {
        type: 'input',
        block_id: 'title_mapping_block',
        element: {
          type: 'static_select',
          action_id: 'title_mapping',
          placeholder: { type: 'plain_text', text: 'Select field' },
          options: destinationFields,
        },
        label: { type: 'plain_text', text: '📌 Insight Title →' },
      },
      // Description mapping
      {
        type: 'input',
        block_id: 'description_mapping_block',
        element: {
          type: 'static_select',
          action_id: 'description_mapping',
          placeholder: { type: 'plain_text', text: 'Select field' },
          options: destinationFields,
        },
        label: { type: 'plain_text', text: '📝 Description →' },
      },
      // Type mapping
      {
        type: 'input',
        block_id: 'type_mapping_block',
        optional: true,
        element: {
          type: 'static_select',
          action_id: 'type_mapping',
          placeholder: { type: 'plain_text', text: 'Select field (optional)' },
          options: destinationFields,
        },
        label: { type: 'plain_text', text: '🏷️  Type →' },
      },
      // Confidence mapping
      {
        type: 'input',
        block_id: 'confidence_mapping_block',
        optional: true,
        element: {
          type: 'static_select',
          action_id: 'confidence_mapping',
          placeholder: { type: 'plain_text', text: 'Select field (optional)' },
          options: destinationFields,
        },
        label: { type: 'plain_text', text: '🎯 Confidence →' },
      },
      // Evidence/Quote mapping
      {
        type: 'input',
        block_id: 'evidence_mapping_block',
        optional: true,
        element: {
          type: 'static_select',
          action_id: 'evidence_mapping',
          placeholder: { type: 'plain_text', text: 'Select field (optional)' },
          options: destinationFields,
        },
        label: { type: 'plain_text', text: '💬 Quote/Evidence →' },
      },
      // Speaker mapping
      {
        type: 'input',
        block_id: 'speaker_mapping_block',
        optional: true,
        element: {
          type: 'static_select',
          action_id: 'speaker_mapping',
          placeholder: { type: 'plain_text', text: 'Select field (optional)' },
          options: destinationFields,
        },
        label: { type: 'plain_text', text: '👤 Speaker →' },
      },
      // Transcript source mapping
      {
        type: 'input',
        block_id: 'source_mapping_block',
        optional: true,
        element: {
          type: 'static_select',
          action_id: 'source_mapping',
          placeholder: { type: 'plain_text', text: 'Select field (optional)' },
          options: destinationFields,
        },
        label: { type: 'plain_text', text: '📄 Source Transcript →' },
      },
    ],
  };
}

export function buildLinearConfigModal() {
  return {
    type: 'modal',
    callback_id: 'configure_linear_export',
    title: { type: 'plain_text', text: 'Configure Linear' },
    submit: { type: 'plain_text', text: 'Next: Map Fields' },
    close: { type: 'plain_text', text: 'Back' },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Linear Configuration*\n\nConnect Linear to create issues from insights automatically.',
        },
      },
      {
        type: 'input',
        block_id: 'label_block',
        element: {
          type: 'plain_text_input',
          action_id: 'label_input',
          placeholder: { type: 'plain_text', text: 'e.g., Customer Feedback' },
        },
        label: { type: 'plain_text', text: 'Label' },
      },
      {
        type: 'input',
        block_id: 'api_key_block',
        element: {
          type: 'plain_text_input',
          action_id: 'api_key_input',
          placeholder: { type: 'plain_text', text: 'lin_api_...' },
        },
        label: { type: 'plain_text', text: 'API Key' },
        hint: {
          type: 'plain_text',
          text: 'Get from: Linear Settings → API',
        },
      },
      {
        type: 'input',
        block_id: 'team_id_block',
        element: {
          type: 'plain_text_input',
          action_id: 'team_id_input',
          placeholder: { type: 'plain_text', text: 'TEAM-XXX' },
        },
        label: { type: 'plain_text', text: 'Team ID' },
      },
      {
        type: 'input',
        block_id: 'project_id_block',
        optional: true,
        element: {
          type: 'plain_text_input',
          action_id: 'project_id_input',
          placeholder: { type: 'plain_text', text: 'PROJECT-XXX (optional)' },
        },
        label: { type: 'plain_text', text: 'Project ID' },
        hint: {
          type: 'plain_text',
          text: 'Leave empty to use team backlog',
        },
      },
    ],
  };
}
