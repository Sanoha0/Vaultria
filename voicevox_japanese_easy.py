#!/usr/bin/env python3
from __future__ import annotations

import json, hashlib, time
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

BASE_URL = 'http://127.0.0.1:50021'
INPUT_FILE = 'japanese.json'
MANIFEST_FILE = 'manifest.json'
OUT_DIR = Path('audio') / 'ja'
NORMAL_SPEED = 1.0
SLOW_SPEED = 0.82


def http_json(method: str, path: str, params=None, body=None):
    url = BASE_URL + path
    if params:
        url += '?' + urlencode(params, doseq=True)
    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    req = Request(url, data=data, method=method, headers=headers)
    with urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode('utf-8'))


def http_bytes(method: str, path: str, params=None, body=None):
    url = BASE_URL + path
    if params:
        url += '?' + urlencode(params, doseq=True)
    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    req = Request(url, data=data, method=method, headers=headers)
    with urlopen(req, timeout=300) as resp:
        return resp.read()


def clean_text(text: str) -> str:
    return ' '.join((text or '').strip().split())


def md5_name(text: str, suffix: str='') -> str:
    return hashlib.md5((text + suffix).encode('utf-8')).hexdigest()[:16] + '.wav'


def extract_entries(doc: dict):
    entries = []
    # stages
    for stage in doc.get('stages', []):
        stage_key = stage.get('key', f"stage_{stage.get('id', 'x')}")
        for unit in stage.get('units', []):
            if unit.get('isCheckpoint'):
                continue
            unit_id = unit.get('id', 'unit')
            for session in unit.get('sessions', []):
                for item in session.get('items', []):
                    if not item.get('audio'):
                        continue
                    target = clean_text(item.get('target', ''))
                    audio_text = clean_text(item.get('audioText') or target)
                    if audio_text:
                        entries.append((target or audio_text, audio_text))
    # phrase library
    for phrase in doc.get('phraseLibrary', []):
        if not phrase.get('audio'):
            continue
        visible = clean_text(phrase.get('phrase', ''))
        audio_text = clean_text(phrase.get('audioText') or visible)
        if audio_text:
            entries.append((visible or audio_text, audio_text))
    # scenarios
    for scene in doc.get('scenarios', []):
        for ex in scene.get('exchanges', []):
            if not ex.get('audio'):
                continue
            visible = clean_text(ex.get('text') or ex.get('modelAnswer') or '')
            audio_text = clean_text(ex.get('audioText') or visible)
            if audio_text:
                entries.append((visible or audio_text, audio_text))
    # dedupe by visible key
    out=[]; seen=set()
    for key_text, audio_text in entries:
        if key_text in seen:
            continue
        seen.add(key_text)
        out.append((key_text, audio_text))
    return out


def choose_speaker() -> int:
    speakers = http_json('GET', '/speakers')
    options = []
    print('\nAvailable Japanese voices:\n')
    idx = 1
    for sp in speakers:
        name = sp.get('name', 'Unknown')
        for style in sp.get('styles', []):
            style_name = style.get('name', 'Normal')
            style_id = style.get('id')
            options.append((style_id, f'{name} - {style_name}'))
            print(f'[{idx}] {name} - {style_name}  (speaker id: {style_id})')
            idx += 1
    print()
    while True:
        raw = input('Type the number you want and press Enter: ').strip()
        if raw.isdigit():
            i = int(raw)
            if 1 <= i <= len(options):
                style_id, label = options[i-1]
                print(f'Using: {label}\n')
                return style_id
        print('Try again. Type one of the numbers shown above.')


def create_query(text: str, speaker: int):
    return http_json('POST', '/audio_query', params={'text': text, 'speaker': speaker})


def synthesize(query: dict, speaker: int):
    return http_bytes('POST', '/synthesis', params={'speaker': speaker}, body=query)


def update_manifest(normal_rows, slow_rows):
    path = Path(MANIFEST_FILE)
    if path.exists():
        manifest = json.loads(path.read_text(encoding='utf-8'))
    else:
        manifest = {}
    manifest = {k:v for k,v in manifest.items() if not (isinstance(k, str) and (k.startswith('ja::') or k.startswith('ja_slow::')))}
    for k,v in normal_rows:
        manifest[k]=v.replace('\\','/')
    for k,v in slow_rows:
        manifest[k]=v.replace('\\','/')
    path.write_text(json.dumps(dict(sorted(manifest.items())), ensure_ascii=False, indent=2), encoding='utf-8')


def main():
    print('VOICEVOX Japanese batch generator\n')
    if not Path(INPUT_FILE).exists():
        print('ERROR: japanese.json was not found in this folder.')
        print('Put this script in the same folder as japanese.json and manifest.json, then run it again.')
        return
    try:
        speaker = choose_speaker()
    except Exception as e:
        print('ERROR: Could not talk to VOICEVOX at http://127.0.0.1:50021')
        print('Open VOICEVOX first, then run this script again.')
        print(f'Details: {e}')
        return

    doc = json.loads(Path(INPUT_FILE).read_text(encoding='utf-8'))
    entries = extract_entries(doc)
    print(f'Found {len(entries)} Japanese lines to generate.\n')

    make_slow = input('Also make slow versions? (y/n): ').strip().lower() == 'y'
    skip_existing = input('Skip files that already exist? (y/n): ').strip().lower() == 'y'

    normal_rows=[]
    slow_rows=[]

    for idx, (key_text, audio_text) in enumerate(entries, start=1):
        print(f'[{idx}/{len(entries)}] {key_text}')
        normal_name = md5_name(key_text)
        normal_rel = Path('audio')/'ja'/normal_name
        normal_abs = OUT_DIR/normal_name
        slow_name = md5_name(key_text, '::slow')
        slow_rel = Path('audio')/'ja'/'slow'/slow_name
        slow_abs = OUT_DIR/'slow'/slow_name
        normal_rows.append((f'ja::{key_text}', str(normal_rel)))
        if make_slow:
            slow_rows.append((f'ja_slow::{key_text}', str(slow_rel)))
        if not (skip_existing and normal_abs.exists()):
            q = create_query(audio_text, speaker)
            q['speedScale']=NORMAL_SPEED
            wav = synthesize(q, speaker)
            normal_abs.parent.mkdir(parents=True, exist_ok=True)
            normal_abs.write_bytes(wav)
        if make_slow and not (skip_existing and slow_abs.exists()):
            q = create_query(audio_text, speaker)
            q['speedScale']=SLOW_SPEED
            wav = synthesize(q, speaker)
            slow_abs.parent.mkdir(parents=True, exist_ok=True)
            slow_abs.write_bytes(wav)
        time.sleep(0.05)

    update_manifest(normal_rows, slow_rows)
    print('\nDone.')
    print('Your Japanese audio files are in audio\\ja')
    if make_slow:
        print('Slow versions are in audio\\ja\\slow')
    print('manifest.json has been updated.')

if __name__ == '__main__':
    main()
