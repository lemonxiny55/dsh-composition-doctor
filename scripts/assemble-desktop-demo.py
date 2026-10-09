"""Assemble real DSH Desktop captures; captions never replace application pixels.

The six screenshots are native UI captures, cropped to the Settings dialog.
This is an edited interaction sequence, with reading pauses, not continuous video.
"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent.parent
directory = root / 'docs/demo'
metadata = json.loads((directory / 'desktop-capture.json').read_text(encoding='utf8'))
report_path = directory / metadata['report']['file']
assert hashlib.sha256(report_path.read_bytes()).hexdigest() == metadata['report']['sha256']
report = json.loads(report_path.read_text(encoding='utf8'))
assert report['profileDir'] == '<PROFILE>' and report['evidenceMode'] == 'static'
assert report['runtimeObserved'] is False
parser = argparse.ArgumentParser()
parser.add_argument('--font', default='C:/Windows/Fonts/msyh.ttc', help='Font with Chinese and Latin glyphs')
args = parser.parse_args()
font = ImageFont.truetype(args.font, 18)
small = ImageFont.truetype(args.font, 15)
frames = []
for entry in metadata['frames']:
    path = directory / entry['file']
    assert hashlib.sha256(path.read_bytes()).hexdigest() == entry['sha256']
    source = Image.open(path).convert('RGB')
    assert source.size == (802, 704)
    frame = Image.new('RGB', (802, 836), '#111923')
    frame.paste(source, (0, 76))
    draw = ImageDraw.Draw(frame)
    draw.text((18, 10), 'DSH Desktop 0.2.0-rc.2  |  Composition Doctor 0.4.0', font=font, fill='#72dec0')
    draw.text((18, 40), entry['caption'], font=font, fill='#eef4f9')
    draw.text((18, 790), 'Real Desktop UI · public #2889 fixture · static · runtime not-observed', font=small, fill='#ffc77c')
    draw.text((18, 813), '真实桌面操作 · 公开模式 fixture · 停留时长经剪辑 · 未自动修复', font=small, fill='#b7c4d2')
    frames.append(frame)
frames[2].save(directory / 'failure-explainer-poster.png')
frames[2].save(directory / 'desktop-explanation.png')
frames[4].save(directory / 'desktop-source.png')
frames[0].save(directory / 'failure-explainer.gif', save_all=True,
               append_images=frames[1:], duration=[f['durationMs'] for f in metadata['frames']],
               loop=0, optimize=True, disposal=2)
with Image.open(directory / 'failure-explainer.gif') as gif:
    total = sum((gif.seek(i), gif.info['duration'])[1] for i in range(gif.n_frames))
    assert gif.n_frames == 6 and total == 25000
print(f'PASS: six real Desktop captures, {total / 1000:g}s, 802x836; UI pixels preserved before GIF quantization')
