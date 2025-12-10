/**
 * Slack App Home View Builder
 */

import { prisma, logger } from '../../index.js';

export async function buildHomeTab(userId: string, activeTab: 'transcripts' | 'insights' = 'transcripts') {
  try {
    // Get transcripts for this user
    const transcripts = await prisma.transcript.findMany({
      where: {
        slack_user_id: userId,
        archived: false,
      },
      orderBy: { created_at: 'desc' },
      take: 10,
      include: {
        _count: {
          select: { insights: true },
        },
      },
    });

    // Get insights for this user
    const insights = await prisma.insight.findMany({
      where: {
        transcript: {
          slack_user_id: userId,
        },
        archived: false,
      },
      include: {
        transcript: {
          select: {
            title: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 20,
    });

    const blocks: any[] = [
      // Header
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📊 MeetyAI - Transcript Analysis',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '_AI-powered transcript analysis with dual-model architecture_',
        },
      },
      {
        type: 'divider',
      },
      // Upload & Settings Buttons (always visible)
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '➕ Upload New Transcript',
              emoji: true,
            },
            style: 'primary',
            action_id: 'upload_transcript_button',
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '⚙️ Settings',
              emoji: true,
            },
            action_id: 'open_settings_button',
          },
        ],
      },
      {
        type: 'divider',
      },
      // Tab Navigation
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📝 Transcripts',
              emoji: true,
            },
            style: activeTab === 'transcripts' ? 'primary' : undefined,
            action_id: 'switch_to_transcripts',
            value: 'transcripts',
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '💡 Insights',
              emoji: true,
            },
            style: activeTab === 'insights' ? 'primary' : undefined,
            action_id: 'switch_to_insights',
            value: 'insights',
          },
        ],
      },
      {
        type: 'divider',
      },
    ];

    // Content based on active tab
    if (activeTab === 'transcripts') {
      // Transcripts Tab Content
      if (transcripts.length === 0) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '_No transcripts yet. Upload your first meeting transcript to get started!_',
          },
        });
      } else {
        for (const transcript of transcripts) {
          const statusEmoji = getStatusEmoji(transcript.status);
          const statusText = getStatusText(transcript.status);
          const insightCount = transcript._count.insights;

          blocks.push({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${transcript.title}*\n${statusEmoji} ${statusText} • ${insightCount} insights\n_Uploaded: ${new Date(transcript.created_at).toLocaleDateString()}_`,
            },
            accessory: {
              type: 'overflow',
              options: [
                {
                  text: {
                    type: 'plain_text',
                    text: '🔄 Re-analyze',
                  },
                  value: transcript.id,
                },
                {
                  text: {
                    type: 'plain_text',
                    text: '🗑️ Archive',
                  },
                  value: transcript.id,
                },
              ],
              action_id: `transcript_menu_${transcript.id}`,
            },
          });
        }
      }
    } else {
      // Insights Tab Content
      if (insights.length === 0) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '_No insights yet. Upload and analyze a transcript to extract insights!_',
          },
        });
      } else {
        for (const insight of insights) {
          const typeEmoji = getInsightTypeEmoji(insight.type);

          blocks.push({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${typeEmoji} *${insight.title}*\n${insight.description}\n_From: ${insight.transcript.title}_`,
            },
            accessory: {
              type: 'overflow',
              options: [
                {
                  text: {
                    type: 'plain_text',
                    text: '📤 Export',
                  },
                  value: insight.id,
                },
                {
                  text: {
                    type: 'plain_text',
                    text: '🗑️ Archive',
                  },
                  value: insight.id,
                },
              ],
              action_id: `insight_menu_${insight.id}`,
            },
          });
        }
      }
    }

    return {
      type: 'home',
      blocks,
    };
  } catch (error) {
    logger.error({ error }, 'Error building app home');

    return {
      type: 'home',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '❌ Error loading app home. Please try again.',
          },
        },
      ],
    };
  }
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case 'file_uploaded':
      return '⏳';
    case 'analyzing_pass_1':
    case 'analyzing_pass_2':
    case 'analyzing_pass_3':
    case 'analyzing_pass_4':
      return '🔄';
    case 'compiling_insights':
      return '📊';
    case 'completed':
      return '✅';
    case 'failed':
      return '❌';
    default:
      return '⏳';
  }
}

function getStatusText(status: string): string {
  switch (status) {
    case 'file_uploaded':
      return 'Pending';
    case 'analyzing_pass_1':
    case 'analyzing_pass_2':
    case 'analyzing_pass_3':
    case 'analyzing_pass_4':
      return 'Analyzing';
    case 'compiling_insights':
      return 'Compiling';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
}

function getInsightTypeEmoji(type: string): string {
  switch (type) {
    case 'pain':
      return '😣';
    case 'blocker':
      return '🚫';
    case 'feature_request':
      return '✨';
    case 'idea':
      return '💡';
    case 'gain':
      return '🎯';
    case 'outcome':
      return '✅';
    case 'objection':
      return '⚠️';
    case 'buying_signal':
      return '💰';
    case 'question':
      return '❓';
    case 'feedback':
      return '💬';
    case 'confusion':
      return '😕';
    case 'opportunity':
      return '🚀';
    default:
      return '📌';
  }
}
