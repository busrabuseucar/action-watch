from pathlib import Path
import json
import zipfile

root = Path(__file__).resolve().parent.parent
target = root / 'dist/download/action-watch-source.zip'
target.parent.mkdir(parents=True, exist_ok=True)
files = []
for path in sorted(root.rglob('*')):
    if not path.is_file():
        continue
    rel = path.relative_to(root)
    if any(part in {'.git', 'node_modules', '__pycache__'} for part in rel.parts) or rel.parts[0] == 'dist':
        continue
    if path.suffix == '.log' or path.name == '.DS_Store':
        continue
    files.append((path, rel))
with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
    for path, rel in files:
        if str(rel) == '.openai/hosting.json':
            archive.writestr(str(rel), json.dumps({'static': {'directory': 'dist'}}, indent=2) + '\n')
        else:
            archive.write(path, str(rel))
with zipfile.ZipFile(target) as archive:
    assert archive.testzip() is None
    assert 'project_id' not in archive.read('.openai/hosting.json').decode()
print(f'Source ZIP: {len(files)} files, {target.stat().st_size} bytes')
