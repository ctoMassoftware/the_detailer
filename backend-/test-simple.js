import dotenv from 'dotenv';
import { validateTwilioConfig } from './src/config/twilio.config.js';

dotenv.config();

console.log('Environment Check:');
console.log('==================');
console.log('TWILIO_ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID ? '✓ Set' : '✗ Missing');
console.log('TWILIO_AUTH_TOKEN:', process.env.TWILIO_AUTH_TOKEN ? '✓ Set' : '✗ Missing');
console.log('TWILIO_WHATSAPP_NUMBER:', process.env.TWILIO_WHATSAPP_NUMBER || '✗ Missing');

console.log('\nValidating Configuration:');
console.log('========================');

try {
  validateTwilioConfig();
  console.log('✓ All Twilio credentials are valid');
} catch (error) {
  console.error('✗ Configuration error:', error.message);
}
