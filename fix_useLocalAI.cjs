const fs = require('fs');
const lines = fs.readFileSync('D:/PCFixAI/src/hooks/useLocalAI.ts', 'utf8').split('\n');
const newLines = lines.map((line, i) => {
  const match = line.match(/^(\s*)const (\w+) = await runRawCommandOutput\(/);
  if (match && !line.match(/^(\s*)const \{ output:/)) {
    const indent = match[1];
    const varname = match[2];
    const newLine = line.replace(
      `const ${varname} = await runRawCommandOutput(`,
      `const { output: ${varname} } = await runRawCommandOutput(`
    );
    console.log('Line ' + (i+1) + ': Fixed ' + varname);
    return newLine;
  }
  return line;
});
fs.writeFileSync('D:/PCFixAI/src/hooks/useLocalAI.ts', newLines.join('\n'));
console.log('Done');