const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/calls/create',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, res => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => console.log('Create:', data));
});
req.write(JSON.stringify({
  call: { id: 'test_123', caller_id: 'user_a', callee_id: 'user_b', call_type: 'audio', room_name: 'test' },
  callerMeta: { id: 'user_a' }
}));
req.end();

setTimeout(() => {
  const req2 = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/calls/incoming',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, res => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => console.log('Incoming:', data));
  });
  req2.write(JSON.stringify({ userId: 'user_b' }));
  req2.end();
}, 500);
