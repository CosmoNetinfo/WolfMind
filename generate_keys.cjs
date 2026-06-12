const { spawn } = require('child_process');

const child = spawn('npm.cmd', ['run', 'tauri', 'signer', 'generate', '-k', 'wolfmind2'], {
  cwd: 'd:\\WolfMind',
  shell: true
});

child.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(output);
  if (output.includes('password')) {
    child.stdin.write('\n');
  }
});

child.stderr.on('data', (data) => {
  console.error(data.toString());
});

child.on('close', (code) => {
  console.log(`Child process exited with code ${code}`);
  process.exit(code);
});
