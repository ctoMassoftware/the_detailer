import twilio from 'twilio';

const validateTwilioConfig = () => {
  const required = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_NUMBER'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing Twilio credentials: ${missing.join(', ')}`);
  }

  // Validate WhatsApp number format
  const whatsappNum = process.env.TWILIO_WHATSAPP_NUMBER;
  if (!whatsappNum.startsWith('whatsapp:')) {
    throw new Error(`TWILIO_WHATSAPP_NUMBER must start with 'whatsapp:' prefix. Got: ${whatsappNum}`);
  }

  return true;
};

const getTwilioClient = () => {
  validateTwilioConfig();
  return twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
};

export { getTwilioClient, validateTwilioConfig };
