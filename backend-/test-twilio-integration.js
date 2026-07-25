import dotenv from 'dotenv';
import { getTwilioClient, validateTwilioConfig } from './src/config/twilio.config.js';
import {
  enviarNotificacionInicioServicio,
  enviarNotificacionOrdenListaSinRifa,
  enviarNotificacionSimple
} from './src/services/whatsapp.service.js';

dotenv.config();

const runTests = async () => {
  console.log('\n========== TWILIO INTEGRATION TEST ==========\n');

  // Test 1: Validate configuration
  console.log('Test 1: Validating Twilio Configuration...');
  try {
    validateTwilioConfig();
    console.log('✓ Configuration valid\n');
  } catch (error) {
    console.error('✗ Configuration validation failed:', error.message);
    process.exit(1);
  }

  // Test 2: Initialize Twilio client
  console.log('Test 2: Initializing Twilio Client...');
  try {
    const client = getTwilioClient();
    console.log('✓ Twilio client initialized\n');
  } catch (error) {
    console.error('✗ Failed to initialize client:', error.message);
    process.exit(1);
  }

  // Test 3: Send test message
  console.log('Test 3: Sending test WhatsApp message...');
  const testNumber = '+573151611975'; // Twilio test number

  try {
    const result = await enviarNotificacionSimple(
      testNumber,
      'Test de integración Twilio - The Detailer',
      { userId: 1 }
    );

    if (result.success) {
      console.log(`✓ Message sent successfully (SID: ${result.sid})\n`);
    } else {
      console.error('✗ Message send failed:', result.error?.message);
    }
  } catch (error) {
    console.error('✗ Test failed with exception:', error.message);
  }

  // Test 4: Send formatted notification
  console.log('Test 4: Sending formatted order notification...');
  try {
    const result = await enviarNotificacionInicioServicio(
      testNumber,
      'Juan García',
      450000,
      { userId: 1 }
    );

    if (result.success) {
      console.log(`✓ Formatted notification sent (SID: ${result.sid})\n`);
    } else {
      console.error('✗ Notification send failed');
    }
  } catch (error) {
    console.error('✗ Test failed:', error.message);
  }

  console.log('========== TEST COMPLETE ==========\n');
};

runTests().catch(console.error);
