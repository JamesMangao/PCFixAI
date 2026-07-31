import re

with open(r'D:\PCFixAI\src\hooks\useLocalAI.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Track which lines need fixing
new_lines = []
for i, line in enumerate(lines):
    # Match: const VARNAME = await runRawCommandOutput(
    # But NOT if it's already destructured: const { output: VARNAME } = await
    # And NOT if it's a different pattern like const VARNAME = await runRawCommand
    match = re.match(r'^(\s*)const (\w+) = await runRawCommandOutput\(', line)
    if match and not re.match(r'^(\s*)const \{ output:', line):
        indent = match.group(1)
        varname = match.group(2)
        # Replace
        new_line = line.replace(
            f'const {varname} = await runRawCommandOutput(',
            f'const {{ output: {varname} }} = await runRawCommandOutput('
        )
        new_lines.append(new_line)
        print(f"Line {i+1}: Fixed '{varname}'")
    else:
        new_lines.append(line)

with open(r'D:\PCFixAI\src\hooks\useLocalAI.ts', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Done")