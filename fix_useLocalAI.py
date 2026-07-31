import re

# Read the file
with open(r'D:\PCFixAI\src\hooks\useLocalAI.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern to find: const X = await runRawCommandOutput(...)
# Replace with: const { output: X } = await runRawCommandOutput(...)

content = re.sub(
    r'const (\w+) = await runRawCommandOutput\(',
    r'const { output: \1 } = await runRawCommandOutput(',
    content
)

# Write back
with open(r'D:\PCFixAI\src\hooks\useLocalAI.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed useLocalAI.ts assignments")