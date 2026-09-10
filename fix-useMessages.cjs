const fs = require('fs');

let content = fs.readFileSync('src/hooks/useMessages.ts', 'utf8');

content = content.replace(
  /channelRef\.current\s*\n\s*\.send\(\{\s*\n\s*type:\s*'broadcast',\s*\n\s*event:\s*'([^']+)',\s*\n\s*payload:\s*(\{[\s\S]*?\})\s*,?\n\s*\}\)\s*\n\s*\.catch\(\(\) => \{\}\);/g,
  (match, eventName, payloadStr) => {
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

fs.writeFileSync('src/hooks/useMessages.ts', content, 'utf8');
console.log('Fixed useMessages.ts');
