import { Pool } from 'pg';
import fetch from 'node-fetch';

// Environment variables
const {
  FB_VERIFY_TOKEN,
  SUPABASE_PG_HOST,
  SUPABASE_PG_PORT,
  SUPABASE_PG_USER,
  SUPABASE_PG_PASSWORD,
  SUPABASE_PG_DATABASE,
  AI_API_URL
} = process.env;

// PostgreSQL client for Supabase
const pool = new Pool({
  host: SUPABASE_PG_HOST,
  port: SUPABASE_PG_PORT,
  user: SUPABASE_PG_USER,
  password: SUPABASE_PG_PASSWORD,
  database: SUPABASE_PG_DATABASE,
  ssl: { rejectUnauthorized: false } // Supabase requires SSL
});

// Call AI API
async function callAIModel(message, pageId) {
  try {
    const response = await fetch(AI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message, page_id: pageId })
    });
    if (!response.ok) throw new Error(`AI API error: ${response.status}`);
    const data = await response.json();
    return data.reply || 'Sorry, I couldn’t process your message.';
  } catch (error) {
    console.error(`AI API error for page ${pageId}: ${error.message}`);
    return 'Sorry, something went wrong.';
  }
}

// Get Page Access Token from Supabase PostgreSQL
async function getPageToken(pageId) {
  try {
    const client = await pool.connect();
    try {
      const res = await client.query('SELECT access_token FROM page_tokens WHERE page_id = $1', [pageId]);
      return res.rows[0]?.access_token || null;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(`Database error for page ${pageId}: ${error.message}`);
    return null;
  }
}

// Send message via Facebook Messenger API
async function sendMessage(recipientId, messageText, pageToken, pageId) {
  const url = 'https://graph.facebook.com/v20.0/me/messages';
  const payload = {
    recipient: { id: recipientId },
    message: { text: messageText },
    access_token: pageToken
  };
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`Facebook API error: ${response.status}`);
    console.log(`Sent response to ${recipientId} on page ${pageId}: ${messageText}`);
  } catch (error) {
    console.error(`Failed to send message to ${recipientId} on page ${pageId}: ${error.message}`);
  }
}

// Main handler
export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Webhook verification
    const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
    if (mode === 'subscribe' && token === FB_VERIFY_TOKEN) {
      console.log('Webhook verified');
      return res.status(200).send(challenge);
    }
    console.error('Webhook verification failed');
    return res.status(403).json({ error: 'Verification failed' });
  }

  if (req.method === 'POST') {
    // Handle incoming messages
    const body = req.body;
    console.log(`Received payload: ${JSON.stringify(body)}`);

    if (body.object === 'page') {
      for (const entry of body.entry || []) {
        const pageId = entry.id;
        const token = await getPageToken(pageId);
        if (!token) {
          console.error(`No token for page ${pageId}`);
          continue;
        }

        for (const event of entry.messaging || []) {
          if (event.message?.text) {
            const senderId = event.sender.id;
            const messageText = event.message.text;
            console.log(`Page ${pageId} received message: ${messageText}`);

            // Call AI model
            // const reply = await callAIModel(messageText, pageId);
            const reply = "hihi";

            // Send response
            await sendMessage(senderId, reply, token, pageId);
          }
        }
      }
    }

    return res.status(200).json({ status: 'ok' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
