/**
 * Test script to verify App Home view builds correctly
 * Run with: npx tsx test-app-home.ts
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function testAppHome() {
  console.log('🧪 Testing App Home view builder...\n');

  // Test with a dummy user ID
  const testUserId = 'U12345TEST';

  try {
    // Import the buildHomeTab function
    const { buildHomeTab } = await import('./src/slack/views/appHome.js');

    console.log(`📝 Building view for user: ${testUserId}`);
    const view = await buildHomeTab(testUserId);

    console.log('\n✅ View built successfully!');
    console.log(`📊 Block count: ${view.blocks?.length || 0}`);
    console.log('\n📄 View structure:');
    console.log(JSON.stringify(view, null, 2));

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error building view:');
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

testAppHome();
