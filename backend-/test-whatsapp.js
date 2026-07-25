import dotenv from 'dotenv';
import { getTwilioClient } from './src/config/twilio.config.js';

dotenv.config();

const testTwilioConnection = async () => {
  try {
    console.log('Connecting to Twilio...');
    const client = getTwilioClient();

    // Get account info to verify connection
    const account = await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();

    console.log('✓ Connected to Twilio');
    console.log(`Account SID: ${account.sid}`);
    console.log(`Status: ${account.status}`);
    console.log(`Type: ${account.type}`);
  } catch (error) {
    console.error('✗ Connection failed:', error.message);
  }
};

testTwilioConnection();
