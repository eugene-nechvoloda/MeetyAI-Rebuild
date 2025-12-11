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

    // Push a new modal view showing "coming soon"
    await client.views.push({
      trigger_id: (body as any).trigger_id,
      view: {
        type: 'modal',
        title: { type: 'plain_text', text: 'Add Export Destination' },
        close: { type: 'plain_text', text: 'Close' },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '🚧 *Coming Soon!*\n\nYou\'ll be able to export insights to:',
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '• *Airtable* - With custom field mapping\n• *Linear* - Create issues automatically\n• *Notion* - Sync to your workspace\n• *Jira* - Add to backlog\n• *Google Sheets* - Export to spreadsheets\n\nWith Zapier-style field mapping! 🎉',
            },
          },
        ],
      },
    });
    logger.info('✅ Export destination modal pushed');
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, '❌ Error handling add export destination');
  }
});

logger.info('✅ Slack handlers registered');
