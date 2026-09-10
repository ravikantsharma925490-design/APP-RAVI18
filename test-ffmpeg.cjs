const { spawn } = require('child_process');
const fs = require('fs');

async function run() {
  try {
    const ff = spawn('ffmpeg', [
      '-y',
      '-i', 'pipe:0',
      '-vn',
      '-c:a', 'libmp3lame',
      '-b:a', '128k',
      '-ar', '44100',
      '-f', 'mp3',
      'pipe:1',
    ]);
    const chunks = [];
    ff.stdout.on('data', d => chunks.push(d));
    ff.stderr.on('data', d => console.log('stderr:', d.toString()));
    ff.on('close', code => console.log('code:', code, chunks.length));
    
    // We don't have a webm easily, let's just observe what happens if we pass empty
    ff.stdin.write(Buffer.from([]));
    ff.stdin.end();
  } catch (e) { console.error(e); }
}
run();
