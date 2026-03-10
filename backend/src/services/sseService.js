/**
 * Server-Sent Events Service for Live Match Updates
 */

// Store active SSE connections
const clients = new Map();

/**
 * Add a client connection
 */
const addClient = (matchId, res) => {
  if (!clients.has(matchId)) {
    clients.set(matchId, new Set());
  }
  clients.get(matchId).add(res);
  console.log(`SSE client connected for match ${matchId}. Total clients: ${clients.get(matchId).size}`);
};

/**
 * Remove a client connection
 */
const removeClient = (matchId, res) => {
  if (clients.has(matchId)) {
    clients.get(matchId).delete(res);
    if (clients.get(matchId).size === 0) {
      clients.delete(matchId);
    }
  }
  console.log(`SSE client disconnected for match ${matchId}`);
};

/**
 * Broadcast update to all clients for a match
 */
const broadcastUpdate = (matchId, eventType, data) => {
  const matchClients = clients.get(matchId);
  if (!matchClients || matchClients.size === 0) {
    return;
  }

  const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  
  matchClients.forEach(client => {
    try {
      client.write(message);
    } catch (error) {
      console.error('Error sending SSE update:', error);
      matchClients.delete(client);
    }
  });
};

/**
 * Setup SSE headers for a new connection
 */
const setupSSE = (res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
};

/**
 * Send initial connection message
 */
const sendConnectionMessage = (res) => {
  res.write('event: connected\ndata: {"status":"connected"}\n\n');
};

module.exports = {
  addClient,
  removeClient,
  broadcastUpdate,
  setupSSE,
  sendConnectionMessage
};
