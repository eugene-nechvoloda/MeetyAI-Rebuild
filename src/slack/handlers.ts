/**
 * Slack Event Handlers
 *
 * Registers all Slack event listeners, modals, actions, and commands
 */

import { slack, logger } from '../index.js';
import { buildHomeTab } from './views/appHome.js';
import { handleUploadModal } from './modals/uploadTranscript.js';
import { processTranscript } from '../services/transcriptProcessor.js';
import { prisma } from '../index.js';
import {
  buildExportProviderSelectionModal,
  buildAirtableConfigModal,
  buildLinearConfigModal,
  buildFieldMappingModal,
} from './views/exportModals.js';
import {
  testExportConnection,
  createExportConfig,
  exportInsight,
  getProviderFields,
} from '../services/exportService.js';

// App Home opened
slack.event('app_home_opened', async ({ event, client }) => {
  try {
    logger.info({ user: event.user, tab: event.tab }, '🏠 App home opened');

    const view = await buildHomeTab(event.user);

    logger.info({ user: event.user, blockCount: view.blocks?.length }, '📝 Built home view');

    await client.views.publish({
      user_id: event.user,
      view: view as any,
    });

    logger.info({ user: event.user }, '✅ Successfully published home view');
  } catch (error) {
    logger.error({ error, user: event.user }, '❌ Error handling app_home_opened');
  }
});

// Upload transcript modal submission
slack.view('upload_transcript_modal', handleUploadModal);

// Re-analyze transcript button
slack.action(/^transcript_menu_/, async ({ body, ack, client, action }) => {
  await ack();

  try {
    if (action.type !== 'overflow') return;

    const selectedOption = action.selected_option;
    const transcriptId = selectedOption.value;
    const userId = body.user.id;

    logger.info(`Action ${selectedOption.text.text} for transcript ${transcriptId}`);

    if (selectedOption.text.text.includes('Re-analyze')) {
      // Trigger re-analysis
      processTranscript(transcriptId).catch(error => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMessage, transcriptId }, `Re-analysis failed for ${transcriptId}: ${errorMessage}`);
      });

      await client.chat.postMessage({
        channel: userId,
        text: `🔄 Re-analysis started for transcript.`,
      });
    } else if (selectedOption.text.text.includes('Archive')) {
      // Archive transcript
      await prisma.transcript.update({
        where: { id: transcriptId },
        data: { archived: true, archived_at: new Date() },
      });

      await client.chat.postMessage({
        channel: userId,
        text: `🗑️ Transcript archived.`,
      });
    }

    // Refresh App Home
    const view = await buildHomeTab(userId);
    await client.views.publish({ user_id: userId, view: view as any });

  } catch (error) {
    logger.error({ error }, 'Error handling transcript menu action');
  }
});

// Upload button - opens modal
slack.action('upload_transcript_button', async ({ body, ack, client }) => {
  try {
    await ack();
    logger.info('📤 Upload button clicked');

    const { buildUploadModal } = await import('./views/uploadModal.js');

    await client.views.open({
      trigger_id: (body as any).trigger_id,
      view: buildUploadModal() as any,
    });

    logger.info('✅ Upload modal opened successfully');
  } catch (error) {
    logger.error({ error }, '❌ Error opening upload modal');
    // Don't call ack() again here - already called above
  }
});

// Settings button - opens settings modal
slack.action('open_settings_button', async ({ ack, client, body }) => {
  try {
    await ack();
    logger.info('⚙️ Settings button clicked');

    const { buildSettingsModal } = await import('./views/settingsModal.js');

    await client.views.open({
      trigger_id: (body as any).trigger_id,
      view: buildSettingsModal() as any,
    });

    logger.info('✅ Settings modal opened successfully');
  } catch (error) {
    logger.error({ error }, '❌ Error opening settings modal');
  }
});

// Tab switching - Transcripts
slack.action('switch_to_transcripts', async ({ ack, client, body }) => {
  try {
    await ack();
    logger.info('📝 Switching to Transcripts tab');

    const userId = (body as any).user.id;
    const view = await buildHomeTab(userId, 'transcripts');

    await client.views.publish({
      user_id: userId,
      view: view as any,
    });
  } catch (error) {
    logger.error({ error }, '❌ Error switching to transcripts tab');
  }
});

// Tab switching - Insights
slack.action('switch_to_insights', async ({ ack, client, body }) => {
  try {
    await ack();
    logger.info('💡 Switching to Insights tab');

    const userId = (body as any).user.id;
    const view = await buildHomeTab(userId, 'insights');

    await client.views.publish({
      user_id: userId,
      view: view as any,
    });
  } catch (error) {
    logger.error({ error }, '❌ Error switching to insights tab');
  }
});

// Add Import Source button (from Settings modal)
slack.action('add_import_source', async ({ ack, client, body }) => {
  try {
    await ack();
    logger.info('📥 Add Import Source clicked');

    // Push a new modal view showing "coming soon"
    await client.views.push({
      trigger_id: (body as any).trigger_id,
      view: {
        type: 'modal',
        title: { type: 'plain_text', text: 'Add Import Source' },
        close: { type: 'plain_text', text: 'Close' },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '🚧 *Coming Soon!*\n\nYou\'ll be able to automatically import transcripts from:',
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '• *Zoom* - Auto-import meeting recordings\n• *Google Meet* - Sync from Google Calendar\n• *Fireflies.ai* - Pull completed transcripts\n• *Custom API* - Webhook integration\n\nStay tuned! 🎉',
            },
          },
        ],
      },
    });
    logger.info('✅ Import source modal pushed');
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, '❌ Error handling add import source');
  }
});

// Add Export Destination button (from Settings modal)
slack.action('add_export_destination', async ({ ack, client, body }) => {
  try {
    await ack();
    logger.info('📤 Add Export Destination clicked');

    await client.views.push({
      trigger_id: (body as any).trigger_id,
      view: buildExportProviderSelectionModal() as any,
    });
    logger.info('✅ Export provider selection modal pushed');
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, '❌ Error handling add export destination');
  }
});

// Export provider selection modal submission
slack.view('select_export_provider', async ({ ack, body, client, view }) => {
  const provider = view.state.values.provider_block.provider_select.selected_option?.value;

  if (!provider) {
    await ack();
    return;
  }

  logger.info({ provider }, '📤 Export provider selected');

  // Show provider-specific configuration modal
  let configModal;
  switch (provider) {
    case 'airtable':
      configModal = buildAirtableConfigModal();
      break;
    case 'linear':
      configModal = buildLinearConfigModal();
      break;
    default:
      await ack();
      await client.chat.postMessage({
        channel: body.user.id,
        text: `🚧 ${provider} export is coming soon!`,
      });
      return;
  }

  // Use response_action to push the next modal
  await ack({
    response_action: 'push',
    view: configModal as any,
  });
});

// Airtable configuration modal submission
slack.view('configure_airtable_export', async ({ ack, body, client, view }) => {
  const userId = body.user.id;
  const values = view.state.values;

  const label = values.label_block.label_input.value;
  const apiKey = values.api_key_block.api_key_input.value;
  const baseId = values.base_id_block.base_id_input.value;
  const tableName = values.table_name_block.table_name_input.value;

  if (!label || !apiKey || !baseId || !tableName) {
    const errors: Record<string, string> = {};
    if (!label) errors.label_block = 'Label is required';
    if (!apiKey) errors.api_key_block = 'API key is required';
    if (!baseId) errors.base_id_block = 'Base ID is required';
    if (!tableName) errors.table_name_block = 'Table name is required';

    await ack({
      response_action: 'errors',
      errors,
    });
    return;
  }

  logger.info({ userId, provider: 'airtable' }, '⚙️ Configuring Airtable export');

  try {
    // Use common field names (user can type actual field names in the dropdown)
    // Note: We skip fetching from Airtable API here to avoid 3-second timeout
    // The connection test will happen when user submits field mapping
    const destinationFields = [
      { text: { type: 'plain_text' as const, text: 'Name' }, value: 'Name' },
      { text: { type: 'plain_text' as const, text: 'Title' }, value: 'Title' },
      { text: { type: 'plain_text' as const, text: 'Description' }, value: 'Description' },
      { text: { type: 'plain_text' as const, text: 'Notes' }, value: 'Notes' },
      { text: { type: 'plain_text' as const, text: 'Type' }, value: 'Type' },
      { text: { type: 'plain_text' as const, text: 'Category' }, value: 'Category' },
      { text: { type: 'plain_text' as const, text: 'Status' }, value: 'Status' },
      { text: { type: 'plain_text' as const, text: 'Priority' }, value: 'Priority' },
      { text: { type: 'plain_text' as const, text: 'Source' }, value: 'Source' },
      { text: { type: 'plain_text' as const, text: 'Author' }, value: 'Author' },
      { text: { type: 'plain_text' as const, text: 'Speaker' }, value: 'Speaker' },
      { text: { type: 'plain_text' as const, text: 'Quote' }, value: 'Quote' },
      { text: { type: 'plain_text' as const, text: 'Evidence' }, value: 'Evidence' },
      { text: { type: 'plain_text' as const, text: 'Confidence' }, value: 'Confidence' },
      { text: { type: 'plain_text' as const, text: 'Date' }, value: 'Date' },
      { text: { type: 'plain_text' as const, text: 'Tags' }, value: 'Tags' },
    ];

    // Store config data in private_metadata (create actual DB record after field mapping)
    const configData = {
      userId,
      provider: 'airtable',
      label: label!,
      apiKey: apiKey!,
      baseId: baseId!,
      tableName: tableName!,
      tableId: undefined, // Will be fetched during connection test
    };

    // Push field mapping modal - must ack within 3 seconds!
    await ack({
      response_action: 'push',
      view: buildFieldMappingModal('airtable', [], destinationFields, JSON.stringify(configData)) as any,
    });

  } catch (error) {
    logger.error({ error }, '❌ Error configuring Airtable export');
    await ack();
    await client.chat.postMessage({
      channel: userId,
      text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
});

// Linear configuration modal submission
slack.view('configure_linear_export', async ({ ack, body, client, view }) => {
  const userId = body.user.id;
  const values = view.state.values;

  const label = values.label_block.label_input.value;
  const apiKey = values.api_key_block.api_key_input.value;
  const teamId = values.team_id_block.team_id_input.value;
  const projectId = values.project_id_block.project_id_input.value;

  if (!label || !apiKey || !teamId) {
    const errors: Record<string, string> = {};
    if (!label) errors.label_block = 'Label is required';
    if (!apiKey) errors.api_key_block = 'API key is required';
    if (!teamId) errors.team_id_block = 'Team ID is required';

    await ack({
      response_action: 'errors',
      errors,
    });
    return;
  }

  logger.info({ userId, provider: 'linear' }, '⚙️ Configuring Linear export');

  try {
    // Mock destination fields for MVP
    const destinationFields = [
      { text: { type: 'plain_text', text: 'Title' }, value: 'Title' },
      { text: { type: 'plain_text', text: 'Description' }, value: 'Description' },
      { text: { type: 'plain_text', text: 'Priority' }, value: 'Priority' },
      { text: { type: 'plain_text', text: 'Label' }, value: 'Label' },
      { text: { type: 'plain_text', text: 'Status' }, value: 'Status' },
    ];

    // Store config data in private_metadata (create actual DB record after field mapping)
    const configData = {
      userId,
      provider: 'linear',
      label: label!,
      apiKey: apiKey!,
      teamId: teamId!,
      projectId: projectId || undefined,
    };

    // Push field mapping modal - must ack within 3 seconds!
    await ack({
      response_action: 'push',
      view: buildFieldMappingModal('linear', [], destinationFields, JSON.stringify(configData)) as any,
    });

  } catch (error) {
    logger.error({ error }, '❌ Error configuring Linear export');
    await ack();
    await client.chat.postMessage({
      channel: userId,
      text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
});

// Field mapping modal submission
slack.view('map_export_fields', async ({ ack, body, client, view }) => {
  await ack();

  const userId = body.user.id;
  const values = view.state.values;

  const fieldMapping = {
    title: values.title_mapping_block?.title_mapping?.selected_option?.value,
    description: values.description_mapping_block?.description_mapping?.selected_option?.value,
    type: values.type_mapping_block?.type_mapping?.selected_option?.value,
    confidence: values.confidence_mapping_block?.confidence_mapping?.selected_option?.value,
    evidence: values.evidence_mapping_block?.evidence_mapping?.selected_option?.value,
    speaker: values.speaker_mapping_block?.speaker_mapping?.selected_option?.value,
    source: values.source_mapping_block?.source_mapping?.selected_option?.value,
  };

  logger.info({ userId, fieldMapping }, '🗺️ Field mapping configured');

  try {
    // Parse config data from private_metadata (stored as JSON from previous modal)
    const configData = JSON.parse(view.private_metadata);

    logger.info({ configData }, '📥 Parsed config data from private_metadata');

    // Fetch table ID from Airtable (happens after ack(), so no timeout risk)
    let tableId = configData.tableId;
    if (!tableId && configData.provider === 'airtable') {
      try {
        const fieldsResult = await getProviderFields('airtable', configData.apiKey, configData.baseId, configData.tableName);
        if (fieldsResult.success && fieldsResult.tableId) {
          tableId = fieldsResult.tableId;
          logger.info({ tableId }, '✅ Fetched table ID from Airtable');
        }
      } catch (error) {
        logger.warn({ error }, '⚠️ Could not fetch table ID, will use table name');
      }
    }

    // Create ExportConfig database record with field mapping
    const configId = await createExportConfig({
      userId: configData.userId,
      provider: configData.provider,
      label: configData.label,
      apiKey: configData.apiKey,
      baseId: configData.baseId,
      tableName: configData.tableName,
      tableId: tableId,
      teamId: configData.teamId,
      projectId: configData.projectId,
      fieldMapping,
    });

    logger.info({ configId }, '✅ Export config created');

    // Test connection
    const testResult = await testExportConnection(configId);

    if (!testResult.success) {
      await client.chat.postMessage({
        channel: userId,
        text: `❌ Connection test failed: ${testResult.error}\n\nPlease check your credentials and try again.`,
      });
      return;
    }

    await client.chat.postMessage({
      channel: userId,
      text: `✅ Export destination configured and tested successfully!\n\nYou can now export insights from the Insights tab.`,
    });

  } catch (error) {
    logger.error({ error }, '❌ Error saving field mapping');
    await client.chat.postMessage({
      channel: userId,
      text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
});

// Export insight from overflow menu
slack.action(/^insight_menu_.*/, async ({ ack, action, body, client }) => {
  await ack();

  if (action.type !== 'overflow') return;

  const selectedOption = action.selected_option;
  const insightId = selectedOption.value;
  const userId = body.user.id;

  logger.info(`Action ${selectedOption.text.text} for insight ${insightId}`);

  if (selectedOption.text.text.includes('Export')) {
    // Get user's export configurations
    const exportConfigs = await prisma.exportConfig.findMany({
      where: { user_id: userId, enabled: true },
    });

    if (exportConfigs.length === 0) {
      await client.chat.postMessage({
        channel: userId,
        text: '📤 No export destinations configured yet.\n\nGo to Settings → Add Export Destination to set one up.',
      });
      return;
    }

    // For MVP, export to the first configured destination
    const config = exportConfigs[0];

    await client.chat.postMessage({
      channel: userId,
      text: `🔄 Exporting insight to ${config.label}...`,
    });

    const result = await exportInsight(insightId, config.id);

    if (result.success && result.skipped) {
      await client.chat.postMessage({
        channel: userId,
        text: `⏭️ Export skipped - this insight already exists in ${config.label}.\n\n${result.explanation}`,
      });
    } else if (result.success) {
      await client.chat.postMessage({
        channel: userId,
        text: `✅ Insight exported to ${config.label} successfully!`,
      });
    } else {
      await client.chat.postMessage({
        channel: userId,
        text: `❌ Export failed: ${result.error}`,
      });
    }
  } else if (selectedOption.text.text.includes('Archive')) {
    await prisma.insight.update({
      where: { id: insightId },
      data: { archived: true, archived_at: new Date() },
    });

    await client.chat.postMessage({
      channel: userId,
      text: '🗑️ Insight archived successfully.',
    });

    // Refresh App Home
    const view = await buildHomeTab(userId, 'insights');
    await client.views.publish({
      user_id: userId,
      view: view as any,
    });
  }
});

logger.info('✅ Slack handlers registered');
