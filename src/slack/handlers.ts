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

    const { buildExportProviderSelectionModal } = await import('./views/exportModals.js');
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
  await ack();

  const provider = view.state.values.provider_block.provider_select.selected_option?.value;
  if (!provider) return;

  logger.info({ provider }, '📤 Export provider selected');

  // Show provider-specific configuration modal
  const { buildAirtableConfigModal, buildLinearConfigModal } = await import('./views/exportModals.js');

  let configModal;
  switch (provider) {
    case 'airtable':
      configModal = buildAirtableConfigModal();
      break;
    case 'linear':
      configModal = buildLinearConfigModal();
      break;
    default:
      await client.chat.postMessage({
        channel: body.user.id,
        text: `🚧 ${provider} export is coming soon!`,
      });
      return;
  }

  await client.views.push({
    trigger_id: (body as any).trigger_id,
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

  await ack();

  logger.info({ userId, provider: 'airtable' }, '⚙️ Configuring Airtable export');

  try {
    // Test connection first
    const { testExportConnection, createExportConfig } = await import('../services/exportService.js');

    // Create temporary config for testing (non-null asserted after validation above)
    const tempConfigId = await createExportConfig({
      userId,
      provider: 'airtable',
      label: label!,
      apiKey: apiKey!,
      baseId: baseId!,
      tableName: tableName!,
      fieldMapping: {}, // Will be set in field mapping step
    });

    const testResult = await testExportConnection(tempConfigId);

    if (!testResult.success) {
      await client.chat.postMessage({
        channel: userId,
        text: `❌ Failed to connect to Airtable: ${testResult.error}\n\nPlease check your API key, Base ID, and Table name.`,
      });
      return;
    }

    // Show field mapping modal
    const { buildFieldMappingModal } = await import('./views/exportModals.js');

    // Mock destination fields for MVP (in production, fetch from Airtable API)
    const destinationFields = [
      { text: { type: 'plain_text', text: 'Title' }, value: 'Title' },
      { text: { type: 'plain_text', text: 'Description' }, value: 'Description' },
      { text: { type: 'plain_text', text: 'Type' }, value: 'Type' },
      { text: { type: 'plain_text', text: 'Confidence' }, value: 'Confidence' },
      { text: { type: 'plain_text', text: 'Quote' }, value: 'Quote' },
      { text: { type: 'plain_text', text: 'Speaker' }, value: 'Speaker' },
      { text: { type: 'plain_text', text: 'Source' }, value: 'Source' },
      { text: { type: 'plain_text', text: 'Status' }, value: 'Status' },
    ];

    await client.views.push({
      trigger_id: (body as any).trigger_id,
      view: buildFieldMappingModal('airtable', [], destinationFields, tempConfigId) as any,
    });

  } catch (error) {
    logger.error({ error }, '❌ Error configuring Airtable export');
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

  await ack();

  logger.info({ userId, provider: 'linear' }, '⚙️ Configuring Linear export');

  try {
    const { testExportConnection, createExportConfig } = await import('../services/exportService.js');

    // Non-null asserted after validation above
    const tempConfigId = await createExportConfig({
      userId,
      provider: 'linear',
      label: label!,
      apiKey: apiKey!,
      teamId: teamId!,
      projectId: projectId || undefined,
      fieldMapping: {},
    });

    const testResult = await testExportConnection(tempConfigId);

    if (!testResult.success) {
      await client.chat.postMessage({
        channel: userId,
        text: `❌ Failed to connect to Linear: ${testResult.error}`,
      });
      return;
    }

    await client.chat.postMessage({
      channel: userId,
      text: `✅ Linear export configured successfully!\n\n*${label}* is now ready to receive insights.`,
    });

  } catch (error) {
    logger.error({ error }, '❌ Error configuring Linear export');
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
  const configId = view.private_metadata;
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

  logger.info({ userId, configId, fieldMapping }, '🗺️ Field mapping configured');

  try {
    // Update the config with field mapping
    await prisma.exportConfig.update({
      where: { id: configId },
      data: { field_mapping: fieldMapping },
    });

    await client.chat.postMessage({
      channel: userId,
      text: `✅ Export destination configured successfully!\n\nYou can now export insights from the Insights tab.`,
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

    const { exportInsight } = await import('../services/exportService.js');
    const result = await exportInsight(insightId, config.id);

    if (result.success) {
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
    const { buildHomeTab } = await import('./views/appHome.js');
    const view = await buildHomeTab(userId, 'insights');
    await client.views.publish({
      user_id: userId,
      view: view as any,
    });
  }
});

logger.info('✅ Slack handlers registered');
