import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:3000/api/simulate-transaction-update';
const transactionId = 'test-tx-123';

console.log(`Connecting to socket server at ${SOCKET_URL}...`);
const socket = io(SOCKET_URL);

socket.on('connect', () => {
  console.log('Connected to socket server:', socket.id);

  // Subscribe
  console.log(`Subscribing to transaction ${transactionId}...`);
  socket.emit('subscribe:transaction', transactionId);

  // Listen for update
  socket.on('transaction:update', (data) => {
    console.log('Received transaction update:', data);
    
    if (data.transactionId === transactionId && data.status === 'confirmed') {
      console.log('Test Passed: Update received correctly');
      socket.disconnect();
      process.exit(0);
    }
  });

  // Trigger update via API after a short delay
  setTimeout(async () => {
    console.log('Triggering update via API...');
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId,
          status: 'confirmed',
          data: { amount: 100 }
        })
      });
      const result = await response.json();
      console.log('API response:', result);
    } catch (error) {
      console.error('API call failed:', error);
      socket.disconnect();
      process.exit(1);
    }
  }, 1000);
});

socket.on('connect_error', (err) => {
  console.error('Connection error:', err);
  process.exit(1);
});
