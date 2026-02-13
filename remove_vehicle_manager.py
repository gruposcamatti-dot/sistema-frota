import os

file_path = r'j:\CUSTOS\frotas\versão nova\src\App.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_line = -1
end_line = -1

for i, line in enumerate(lines):
    if line.strip().startswith('function VehicleManager({ vehicles, db, appId }) {'):
        start_line = i
    if start_line != -1 and line.strip() == '}' and lines[i-1].strip() == ');':
        # This is a heuristic, looking for `);` followed by `}` which is typical for React components
        # Verify indentation or look-ahead to ensure it's the component end.
        # Based on my read, VehicleManager ends at 805.
        # Line 804 is `  );`
        # Line 805 is `}`
        # Next line is `function ImportModule...`
        if i + 2 < len(lines) and 'function ImportModule' in lines[i+2]:
             end_line = i
             break
        # Or if it's just followed by ImportModule
        if i + 2 < len(lines) and 'function ImportModule' in lines[i+2]:
             end_line = i
             break
        # Let's check if the NEXT non-empty line starts with function ImportModule
        j = i + 1
        while j < len(lines) and lines[j].strip() == '':
            j += 1
        if j < len(lines) and lines[j].strip().startswith('function ImportModule'):
            end_line = i
            break

if start_line != -1 and end_line != -1:
    print(f"Removing lines {start_line+1} to {end_line+1}")
    new_lines = lines[:start_line] + ['// VehicleManager extracted to ./components/VehicleManager.jsx\n'] + lines[end_line+1:]
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    print("Success")
else:
    print(f"Could not find range. Start: {start_line}, End: {end_line}")
