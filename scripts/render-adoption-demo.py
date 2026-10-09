"""Render captured CLI text as a 25-second GitHub GIF (Pillow only).

This is a text rendering, not a screen recording or a DSH runtime replay.
Run capture-adoption-demo.mjs first. Pass --font to use a different mono font.
"""
import argparse
import json
import textwrap
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--font', default='C:/Windows/Fonts/CascadiaMono.ttf')
args = parser.parse_args()
capture = json.loads((root / 'docs/demo/adoption-capture.json').read_text(encoding='utf-8'))
font = ImageFont.truetype(args.font, 22)
small = ImageFont.truetype(args.font, 19)
title = ImageFont.truetype(args.font, 30)
W = 1400
bg, fg, green, muted = '#101a23', '#e3edf5', '#62e3ba', '#a7bbcc'


def panel(heading, label, text, height=650):
    H = height
    im = Image.new('RGB', (W, H), bg)
    draw = ImageDraw.Draw(im)
    draw.rounded_rectangle((28, 28, W - 28, H - 28), radius=20, outline='#354858', width=2)
    draw.text((56, 55), 'COMPOSITION DOCTOR 0.4.0', font=title, fill=green)
    draw.text((56, 103), heading, font=font, fill=fg)
    draw.text((56, 148), label, font=small, fill=muted)
    draw.line((56, 185, W - 56, 185), fill='#354858', width=2)
    y = 210
    for original in text.strip().splitlines():
        lines = textwrap.wrap(original, width=96, replace_whitespace=False,
                              drop_whitespace=False, break_long_words=False) or ['']
        color = green if original.startswith(('Path ', 'Next:', '$ ')) else fg
        if original.startswith(('Unknown:', 'reported-by-log;', 'Profile:')):
            color = '#ffc77c'
        for line in lines:
            assert y < H - 110, f'Text overflows: {heading}'
            assert draw.textlength(line, font=font) < W - 112, f'Line too wide: {line}'
            draw.text((56, y), line, font=font, fill=color)
            y += 29
    draw.line((56, H - 97, W - 56, H - 97), fill='#354858', width=2)
    draw.text((56, H - 77), 'Actual CLI output on minimized fixtures | static evidence | runtime unknown',
              font=small, fill=muted)
    return im


frames = []
durations = [3000, 3000, 10000, 4000, 5000]
for i, scene in enumerate(capture['scenes']):
    heading = ['One id, two insertion paths', 'Installed package, missing declared patch'][i]
    result = panel(heading, 'Full stdout from published npm 0.4.0; wrapped for readability', scene['stdout'], height=1060)
    result.save(root / f'docs/demo/{scene["name"]}.png')
scene = capture['scenes'][0]
lines = scene['stdout'].splitlines()
frames.append(panel('Plugin added, Web UI will not open?', '1 / 5 - minimized reconstruction of public DSH case #2889',
                    'Symptom input:\n\n' + scene['log']))
frames.append(panel('Ask the standalone CLI for source paths', '2 / 5 - actual diagnosis; no DSH runtime started',
                    scene['command'] + '\n\nSelected profile: the inert duplicate-insertion fixture.'))
excerpt = '\n'.join(line for line in lines if line.startswith((
    'Duplicate loader', 'reported-by-log;', 'Path ', '  layer:', 'Unknown:')))
frames.append(panel('Same id: bundle insertion + profile insertion', '3 / 5 - exact stdout excerpt; full stdout is linked beside the GIF', excerpt))
next_step = '\n'.join(line for line in lines if line.startswith(('Unknown:', 'Next:', 'Doctor did')))
frames.append(panel('Review both declarations before changing anything', '4 / 5 - exact stdout excerpt; no automatic repair', next_step))
frames.append(panel('Try it. Share whether the next step helped.', '5 / 5 - Node.js >=20 | no telemetry',
                    '$ npm install -g dsh-composition-doctor@0.4.0 --ignore-scripts\n\n'
                    '$ dsh-doctor check --profile <profile-dir>\n\n'
                    'No supported match means unknown, not healthy.\n\n'
                    'github.com/lemonxiny55/dsh-composition-doctor'))
Image.open(root / 'docs/demo/manual-bundle-duplicate.png').save(root / 'docs/demo/failure-explainer-poster.png')
frames[0].save(root / 'docs/demo/failure-explainer.gif', save_all=True,
               append_images=frames[1:], duration=durations, loop=0, optimize=True, disposal=2)
with Image.open(root / 'docs/demo/failure-explainer.gif') as gif:
    actual = sum((gif.seek(i), gif.info['duration'])[1] for i in range(gif.n_frames))
    assert gif.n_frames == 5 and actual == 25000
    dimensions = gif.size
print(f'GIF: 5 frames, {actual / 1000:g}s, {dimensions[0]}x{dimensions[1]}')
