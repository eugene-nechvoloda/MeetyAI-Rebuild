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
        logger.error(`Re-analysis failed for ${transcriptId}:`, error);
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

// Settings button - placeholder for now
slack.action('open_settings_button', async ({ ack, client, body }) => {
  try {
    await ack();
    logger.info('⚙️ Settings button clicked');

    // For now, send a message that settings are coming soon
    await client.chat.postMessage({
      channel: (body as any).user.id,
      text: '⚙️ Settings feature coming soon! You\'ll be able to configure:\n• AI models\n• Import sources\n• Export destinations\n• Custom context and examples',
    });
  } catch (error) {
    logger.error({ error }, '❌ Error handling settings button');
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

logger.info('✅ Slack handlers registered');
