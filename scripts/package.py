#!/usr/bin/env python3
"""Build an upload ZIP containing runtime files only; manifest is at ZIP root."""
from pathlib import Path
import json,zipfile
root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'manifest.json').read_text())
runtime=['manifest.json','background.js','collector.js','core.js','attachments.js','source-fetch.js','workflow.js','downloads.js','export.html','export.js','style.css','zip.js','README.md','PRIVACY.md']
runtime += [str(p.relative_to(root)) for p in sorted((root/'icons').glob('*.png'))]
out=root/'dist'/f'TicketPack-{manifest["version"]}-chrome-store.zip'
out.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
 for name in runtime:z.write(root/name,name)
with zipfile.ZipFile(out) as z:
 assert 'manifest.json' in z.namelist()
 assert z.testzip() is None
print(out)
