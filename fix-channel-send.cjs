const fs = require('fs');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // In useMessages.ts
  content = content.replace(
    /channelRef\.current\s*\n\s*\.send\(\{\s*\n\s*type:\s*'broadcast',\s*\n\s*event:\s*'([^']+)',\s*\n\s*payload:\s*(\{[\s\S]*?\})\s*,\?\n\s*\}\)\s*\n\s*\.catch\(\(\) => \{\}\);/g,
    (match, eventName, payloadStr) => {
      // payloadStr might have trailing spaces, let's just use it
      return `if ((channelRef.current as any).state === 'joined') {
          channelRef.current
            .send({
              type: 'broadcast',
              event: '${eventName}',
              payload: ${payloadStr}
            })
            .catch(() => {});
        } else if (typeof (channelRef.current as any).httpSend === 'function') {
          (channelRef.current as any)
            .httpSend('${eventName}', ${payloadStr})
            .catch(() => {});
        }`;
    }
  );

  fs.writeFileSync(filePath, content, 'utf8');
}

fixFile('src/hooks/useMessages.ts');
console.log('Fixed useMessages.ts');

let p2pContent = fs.readFileSync('src/lib/webrtc/p2p-session.ts', 'utf8');
p2pContent = p2pContent.replace(
  /this\.supabaseChannel\s*\n\s*\.send\(\{\s*\n\s*type:\s*'broadcast',\s*\n\s*event:\s*'webrtc_signal',\s*\n\s*payload:\s*payload,\s*\n\s*\}\)\s*\n\s*\.catch\(\(\) => \{\}\);/g,
  `if ((this.supabaseChannel as any).state === 'joined') {
        this.supabaseChannel
          .send({
            type: 'broadcast',
            event: 'webrtc_signal',
            payload: payload,
          })
          .catch(() => {});
      } else if (typeof (this.supabaseChannel as any).httpSend === 'function') {
        (this.supabaseChannel as any)
          .httpSend('webrtc_signal', payload)
          .catch(() => {});
      }`
);
fs.writeFileSync('src/lib/webrtc/p2p-session.ts', p2pContent, 'utf8');
console.log('Fixed p2p-session.ts');
