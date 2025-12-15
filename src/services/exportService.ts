/**
 * Export Service
 * Handles exporting insights to various third-party platforms
 */

import { logger, prisma } from '../index.js';
import crypto from 'crypto';
import Anthropic from '@anthropic-ai/sdk';

// Encryption/decryption (simplified for MVP - use proper key management in production)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production-32b';
const ALGORITHM = 'aes-256-gcm';

// Anthropic client for duplicate detection
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Get all export configs for a user
 */
export async function getUserExportConfigs(userId: string) {
  return await prisma.exportConfig.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
  });
}

/**
 * Get a specific export config by ID
 */
export async function getExportConfigById(configId: string) {
  return await prisma.exportConfig.findUnique({
    where: { id: configId },
  });
}

/**
 * Delete an export config
 */
export async function deleteExportConfig(configId: string) {
  return await prisma.exportConfig.delete({
    where: { id: configId },
  });
}

/**
 * Create export configuration
 */
export async function createExportConfig(params: {
  userId: string;
  provider: string;
  label: string;
  apiKey: string;
  apiSecret?: string;
  baseId?: string;
  tableName?: string;
  tableId?: string;
  teamId?: string;
  projectId?: string;
  databaseId?: string;
  sheetId?: string;
  workspaceId?: string;
  apiEndpoint?: string;
  fieldMapping: any;
}): Promise<string> {
  const config = await prisma.exportConfig.create({
    data: {
      user_id: params.userId,
      provider: params.provider,
      label: params.label,
      api_key_encrypted: encrypt(params.apiKey),
      api_secret_encrypted: params.apiSecret ? encrypt(params.apiSecret) : null,
      auth_type: 'api_key',
      base_id: params.baseId,
      table_name: params.tableName,
      table_id: params.tableId,
      team_id: params.teamId,
      project_id: params.projectId,
      database_id: params.databaseId,
      sheet_id: params.sheetId,
      workspace_id: params.workspaceId,
      api_endpoint: params.apiEndpoint,
      field_mapping: params.fieldMapping,
      enabled: true,
    },
  });

  logger.info({ configId: config.id, provider: params.provider }, '✅ Export config created');
  return config.id;
}

/**
 * Get available fields from provider
 */
export async function getProviderFields(provider: string, apiKey: string, baseId?: string, tableName?: string): Promise<{ success: boolean; fields?: Array<{ id: string; name: string; type?: string }>; tableId?: string; error?: string }> {
  try {
    switch (provider) {
      case 'airtable':
        if (!baseId || !tableName) {
          return { success: false, error: 'Base ID and table name are required' };
        }
        return await getAirtableFields(apiKey, baseId, tableName);
      default:
        return { success: false, error: 'Provider not supported' };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Test export connection
 */
export async function testExportConnection(configId: string): Promise<{ success: boolean; error?: string }> {
  const config = await prisma.exportConfig.findUnique({ where: { id: configId } });
  if (!config) {
    return { success: false, error: 'Configuration not found' };
  }

  try {
    const apiKey = decrypt(config.api_key_encrypted);

    switch (config.provider) {
      case 'airtable':
        return await testAirtableConnection(apiKey, config.base_id!, config.table_id || config.table_name!);
      case 'linear':
        return await testLinearConnection(apiKey, config.team_id!);
      case 'notion':
        return await testNotionConnection(apiKey, config.database_id!);
      case 'jira':
        return await testJiraConnection(apiKey, config.api_secret_encrypted ? decrypt(config.api_secret_encrypted) : '', config.api_endpoint!);
      case 'google_sheets':
        return await testGoogleSheetsConnection(apiKey, config.sheet_id!);
      default:
        return { success: false, error: 'Unknown provider' };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage, configId }, '❌ Export connection test failed');
    return { success: false, error: errorMessage };
  }
}

/**
 * Export single insight
 */
export async function exportInsight(insightId: string, configId: string): Promise<{ success: boolean; error?: string; skipped?: boolean; explanation?: string }> {
  try {
    const insight = await prisma.insight.findUnique({
      where: { id: insightId },
      include: { transcript: true },
    });

    if (!insight) {
      return { success: false, error: 'Insight not found' };
    }

    const config = await prisma.exportConfig.findUnique({ where: { id: configId } });
    if (!config || !config.enabled) {
      return { success: false, error: 'Export configuration not found or disabled' };
    }

    const apiKey = decrypt(config.api_key_encrypted);
    const fieldMapping = config.field_mapping as any;

    // Map insight fields to destination fields
    const mappedData: any = {};
    if (fieldMapping.title) mappedData[fieldMapping.title] = insight.title;
    if (fieldMapping.description) mappedData[fieldMapping.description] = insight.description;
    if (fieldMapping.type) mappedData[fieldMapping.type] = insight.type;
    if (fieldMapping.confidence) mappedData[fieldMapping.confidence] = insight.confidence;
    if (fieldMapping.evidence) mappedData[fieldMapping.evidence] = insight.evidence_text;
    if (fieldMapping.speaker) mappedData[fieldMapping.speaker] = insight.speaker;
    if (fieldMapping.source) mappedData[fieldMapping.source] = insight.transcript.title;

    // Export to provider
    let result: { success: boolean; error?: string; recordId?: string; skipped?: boolean };
    switch (config.provider) {
      case 'airtable':
        result = await exportToAirtable(apiKey, config.base_id!, config.table_id || config.table_name!, mappedData);
        break;
      case 'linear':
        result = await exportToLinear(apiKey, config.team_id!, config.project_id, mappedData);
        break;
      case 'notion':
        result = await exportToNotion(apiKey, config.database_id!, mappedData);
        break;
      case 'jira':
        result = await exportToJira(apiKey, config.api_secret_encrypted ? decrypt(config.api_secret_encrypted) : '', config.api_endpoint!, mappedData);
        break;
      case 'google_sheets':
        result = await exportToGoogleSheets(apiKey, config.sheet_id!, mappedData);
        break;
      default:
        return { success: false, error: 'Unknown provider' };
    }

    if (result.success && result.skipped) {
      // Duplicate found, don't create new record but still mark as successful
      logger.info({ insightId, configId }, '⏭️ Export skipped - duplicate found');
      return {
        success: true,
        skipped: true,
        explanation: 'This insight already exists in the destination',
      };
    }

    if (result.success) {
      // Update insight status
      await prisma.insight.update({
        where: { id: insightId },
        data: {
          exported: true,
          status: 'exported',
          export_destinations: {
            ...((insight.export_destinations as any) || {}),
            [config.provider]: {
              configId,
              recordId: result.recordId,
              exportedAt: new Date().toISOString(),
            },
          },
        },
      });

      // Update export config stats
      await prisma.exportConfig.update({
        where: { id: configId },
        data: {
          last_export_at: new Date(),
          last_export_count: { increment: 1 },
          total_exported: { increment: 1 },
        },
      });

      logger.info({ insightId, configId, provider: config.provider }, '✅ Insight exported successfully');
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage, insightId, configId }, '❌ Export failed');
    return { success: false, error: errorMessage };
  }
}

// Provider-specific implementations

async function getAirtableFields(apiKey: string, baseId: string, tableNameOrId: string): Promise<{ success: boolean; fields?: Array<{ id: string; name: string; type: string }>; tableId?: string; error?: string }> {
  try {
    const response = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Airtable API error: ${response.status} - ${error}` };
    }

    const result = await response.json() as { tables: Array<{ id: string; name: string; fields: Array<{ id: string; name: string; type: string }> }> };
    const table = result.tables.find(t => t.name === tableNameOrId || t.id === tableNameOrId);

    if (!table) {
      return { success: false, error: `Table "${tableNameOrId}" not found in base` };
    }

    return { success: true, fields: table.fields, tableId: table.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function testAirtableConnection(apiKey: string, baseId: string, tableIdOrName: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Airtable API error: ${response.status} - ${error}` };
    }

    const result = await response.json() as { tables: Array<{ id: string; name: string }> };
    const tableExists = result.tables.some(t => t.name === tableIdOrName || t.id === tableIdOrName);

    if (!tableExists) {
      return { success: false, error: `Table "${tableIdOrName}" not found in base` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function fetchAirtableRecords(apiKey: string, baseId: string, tableIdOrName: string): Promise<{ success: boolean; records?: Array<{ id: string; fields: any }>; error?: string }> {
  try {
    const response = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableIdOrName)}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Airtable API error: ${response.status} - ${error}` };
    }

    const result = await response.json() as { records: Array<{ id: string; fields: any }> };
    return { success: true, records: result.records };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function checkForDuplicate(newRecord: any, existingRecords: Array<{ id: string; fields: any }>): Promise<{ isDuplicate: boolean; matchedRecordId?: string; explanation?: string }> {
  try {
    if (existingRecords.length === 0) {
      return { isDuplicate: false };
    }

    // Prepare data for Claude
    const existingRecordsText = existingRecords.map((record, idx) => {
      const fields = Object.entries(record.fields)
        .map(([key, value]) => `  ${key}: ${value}`)
        .join('\n');
      return `Record ${idx + 1} (ID: ${record.id}):\n${fields}`;
    }).join('\n\n');

    const newRecordText = Object.entries(newRecord)
      .map(([key, value]) => `  ${key}: ${value}`)
      .join('\n');

    const prompt = `You are analyzing whether a new insight is a TRUE DUPLICATE of existing records in Airtable.

NEW INSIGHT TO BE ADDED:
${newRecordText}

EXISTING RECORDS IN AIRTABLE:
${existingRecordsText}

CRITICAL: Be VERY STRICT about duplicates. An insight is ONLY a duplicate if ALL of these conditions are met:

1. **SAME SPEAKER/AUTHOR**: The speaker/author field must match exactly or be clearly the same person
2. **SAME SOURCE/COMPANY**: Must be from the same company/organization/conversation
3. **SAME SPECIFIC INSIGHT**: Must be the exact same finding, just reworded slightly
4. **SAME EVIDENCE/QUOTE**: The quote or evidence should reference the same statement or context

DO NOT mark as duplicate if:
- Different speakers are talking about similar topics (e.g., "John from Acme complaining about onboarding" vs "Sarah from Beta complaining about onboarding" = NOT DUPLICATES, export both!)
- Same speaker but different specific issues (e.g., "slow onboarding" vs "missing features" = NOT DUPLICATES)
- Similar themes but different contexts or details
- Different companies/sources discussing the same general problem

EXAMPLES OF TRUE DUPLICATES (should skip):
- Record 1: Speaker="John Smith, Acme Corp", Quote="Our onboarding takes 3 days which is too long"
- Record 2: Speaker="John Smith, Acme", Quote="The onboarding process is taking us about 3 days"
→ DUPLICATE (same person, same company, same specific issue, just reworded)

EXAMPLES OF NOT DUPLICATES (should export both):
- Record 1: Speaker="John, Acme Corp", Quote="Onboarding is too slow"
- Record 2: Speaker="Sarah, Beta Inc", Quote="Our onboarding process is slow too"
→ NOT DUPLICATE (different speakers, different companies, even if similar topic)

Only mark as duplicate if you are HIGHLY CONFIDENT (>95%) that it's the exact same insight from the same person/source.

Respond in JSON format:
{
  "isDuplicate": true/false,
  "matchedRecordId": "record ID if duplicate, null otherwise",
  "explanation": "brief explanation focusing on speaker/source comparison"
}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: prompt,
      }],
    });

    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return { isDuplicate: false };
    }

    const result = JSON.parse(textContent.text);
    logger.info({ result }, '🔍 Duplicate check result');

    return {
      isDuplicate: result.isDuplicate,
      matchedRecordId: result.matchedRecordId,
      explanation: result.explanation,
    };
  } catch (error) {
    logger.error({ error }, '❌ Error checking for duplicates');
    // If duplicate check fails, allow export to proceed
    return { isDuplicate: false };
  }
}

async function exportToAirtable(apiKey: string, baseId: string, tableIdOrName: string, data: any): Promise<{ success: boolean; error?: string; recordId?: string; skipped?: boolean }> {
  try {
    // Fetch existing records to check for duplicates
    const existingResult = await fetchAirtableRecords(apiKey, baseId, tableIdOrName);

    if (!existingResult.success) {
      logger.warn({ error: existingResult.error }, '⚠️ Could not fetch existing records, proceeding with export');
    } else if (existingResult.records) {
      // Check for duplicates using Claude
      const duplicateCheck = await checkForDuplicate(data, existingResult.records);

      if (duplicateCheck.isDuplicate) {
        logger.info({
          matchedRecordId: duplicateCheck.matchedRecordId,
          explanation: duplicateCheck.explanation,
        }, '⏭️ Skipping duplicate export');

        return {
          success: true,
          recordId: duplicateCheck.matchedRecordId,
          skipped: true,
        };
      }
    }

    // No duplicate found, proceed with creating new record
    const response = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableIdOrName)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields: data }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Airtable API error: ${response.status} - ${error}` };
    }

    const result = await response.json() as { id: string };
    return { success: true, recordId: result.id, skipped: false };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function testLinearConnection(apiKey: string, teamId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `query { team(id: "${teamId}") { id name } }`,
      }),
    });

    if (!response.ok) {
      return { success: false, error: `Linear API error: ${response.status}` };
    }

    const result = await response.json() as { errors?: Array<{ message: string }> };
    if (result.errors) {
      return { success: false, error: result.errors[0].message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function exportToLinear(apiKey: string, teamId: string, projectId: string | null, data: any): Promise<{ success: boolean; error?: string; recordId?: string }> {
  try {
    const mutation = `
      mutation IssueCreate($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue {
            id
            identifier
          }
        }
      }
    `;

    const input: any = {
      teamId,
      title: data[Object.keys(data).find(k => data[k] === data.title) || 'title'] || 'Untitled',
      description: data[Object.keys(data).find(k => data[k] === data.description) || 'description'],
    };

    if (projectId) {
      input.projectId = projectId;
    }

    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: mutation, variables: { input } }),
    });

    if (!response.ok) {
      return { success: false, error: `Linear API error: ${response.status}` };
    }

    const result = await response.json() as {
      errors?: Array<{ message: string }>;
      data?: { issueCreate: { issue: { identifier: string } } };
    };
    if (result.errors) {
      return { success: false, error: result.errors[0].message };
    }

    return { success: true, recordId: result.data?.issueCreate?.issue?.identifier };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// Placeholder implementations for other providers
async function testNotionConnection(apiKey: string, databaseId: string): Promise<{ success: boolean; error?: string }> {
  return { success: true }; // TODO: Implement
}

async function exportToNotion(apiKey: string, databaseId: string, data: any): Promise<{ success: boolean; error?: string; recordId?: string }> {
  return { success: false, error: 'Notion export not yet implemented' };
}

async function testJiraConnection(apiKey: string, apiSecret: string, apiEndpoint: string): Promise<{ success: boolean; error?: string }> {
  return { success: true }; // TODO: Implement
}

async function exportToJira(apiKey: string, apiSecret: string, apiEndpoint: string, data: any): Promise<{ success: boolean; error?: string; recordId?: string }> {
  return { success: false, error: 'Jira export not yet implemented' };
}

async function testGoogleSheetsConnection(apiKey: string, sheetId: string): Promise<{ success: boolean; error?: string }> {
  return { success: true }; // TODO: Implement
}

async function exportToGoogleSheets(apiKey: string, sheetId: string, data: any): Promise<{ success: boolean; error?: string; recordId?: string }> {
  return { success: false, error: 'Google Sheets export not yet implemented' };
}
