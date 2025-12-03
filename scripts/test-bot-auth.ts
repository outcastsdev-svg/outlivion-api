/**
 * Test script for Telegram Bot Deep-Link Authentication
 * Usage: tsx scripts/test-bot-auth.ts
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';

interface TestResult {
  step: string;
  success: boolean;
  data?: any;
  error?: string;
}

const results: TestResult[] = [];

function log(message: string, data?: any) {
  console.log(`\n[Test] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testCreateLoginToken(): Promise<string | null> {
  try {
    log('Step 1: Creating login token...');
    
    const response = await axios.post(`${API_URL}/auth/bot/create-login-token`);
    const { token, botUrl, expiresAt } = response.data;

    log('✅ Token created successfully', { token, botUrl, expiresAt });
    
    results.push({
      step: 'Create login token',
      success: true,
      data: { token, botUrl },
    });

    return token;
  } catch (error: any) {
    log('❌ Failed to create token', error.response?.data || error.message);
    
    results.push({
      step: 'Create login token',
      success: false,
      error: error.message,
    });

    return null;
  }
}

async function testCheckLogin(token: string, expectedStatus: string) {
  try {
    log(`Step: Checking login status (expecting: ${expectedStatus})...`);
    
    const response = await axios.get(`${API_URL}/auth/bot/check-login?token=${token}`);
    const { status, message } = response.data;

    if (status === expectedStatus) {
      log(`✅ Status is ${status} as expected`);
      
      results.push({
        step: `Check login (${expectedStatus})`,
        success: true,
        data: response.data,
      });

      return response.data;
    } else {
      log(`⚠️ Status is ${status}, expected ${expectedStatus}`);
      
      results.push({
        step: `Check login (${expectedStatus})`,
        success: false,
        error: `Expected ${expectedStatus}, got ${status}`,
      });

      return null;
    }
  } catch (error: any) {
    log('❌ Failed to check login', error.response?.data || error.message);
    
    results.push({
      step: `Check login (${expectedStatus})`,
      success: false,
      error: error.message,
    });

    return null;
  }
}

async function testConfirmLogin(token: string) {
  try {
    log('Step: Confirming login (simulating bot)...');
    
    const response = await axios.post(`${API_URL}/auth/bot/confirm-login`, {
      token,
      telegramId: '123456789',
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
    });

    const { ok, message } = response.data;

    if (ok) {
      log('✅ Login confirmed successfully', { message });
      
      results.push({
        step: 'Confirm login',
        success: true,
        data: response.data,
      });

      return true;
    } else {
      log('❌ Login confirmation failed', { message });
      
      results.push({
        step: 'Confirm login',
        success: false,
        error: message,
      });

      return false;
    }
  } catch (error: any) {
    log('❌ Failed to confirm login', error.response?.data || error.message);
    
    results.push({
      step: 'Confirm login',
      success: false,
      error: error.message,
    });

    return false;
  }
}

async function runTests() {
  console.log('\n🧪 Starting Telegram Bot Auth Tests...');
  console.log('API URL:', API_URL);
  console.log('=====================================\n');

  // Test 1: Create login token
  const token = await testCreateLoginToken();
  if (!token) {
    console.log('\n❌ Test suite failed - could not create token');
    return;
  }

  await sleep(1000);

  // Test 2: Check status - should be pending
  await testCheckLogin(token, 'pending');

  await sleep(1000);

  // Test 3: Confirm login (simulate bot)
  const confirmed = await testConfirmLogin(token);
  if (!confirmed) {
    console.log('\n❌ Test suite failed - could not confirm login');
    return;
  }

  await sleep(1000);

  // Test 4: Check status - should be approved with tokens
  const approvedData = await testCheckLogin(token, 'approved');
  
  if (approvedData && approvedData.accessToken) {
    log('✅ Received access token', {
      tokenLength: approvedData.accessToken.length,
      hasRefreshToken: !!approvedData.refreshToken,
      user: approvedData.user,
    });
  }

  await sleep(1000);

  // Test 5: Try to use token again - should fail
  try {
    log('Step: Trying to reuse token (should fail)...');
    await axios.post(`${API_URL}/auth/bot/confirm-login`, {
      token,
      telegramId: '987654321',
      username: 'hacker',
      firstName: 'Hacker',
    });
    
    log('❌ Security issue: Token was reused!');
    results.push({
      step: 'Prevent token reuse',
      success: false,
      error: 'Token should not be reusable',
    });
  } catch (error: any) {
    if (error.response?.status === 404) {
      log('✅ Token reuse prevented (404 error)');
      results.push({
        step: 'Prevent token reuse',
        success: true,
      });
    } else {
      log('⚠️ Unexpected error on token reuse', error.message);
    }
  }

  // Print summary
  console.log('\n\n=====================================');
  console.log('📊 Test Results Summary');
  console.log('=====================================\n');

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const total = results.length;

  results.forEach((result, index) => {
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${index + 1}. ${result.step}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log(`\n📈 Total: ${passed}/${total} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed!\n');
  } else {
    console.log('\n⚠️ Some tests failed. Check the logs above.\n');
  }
}

// Run tests
runTests().catch((error) => {
  console.error('\n💥 Test suite crashed:', error);
  process.exit(1);
});

