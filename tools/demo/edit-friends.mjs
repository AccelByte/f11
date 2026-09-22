import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';

if (!process.argv[2])
  throw new Error('Usage: node tools/demo/edit-friends.mjs artifacts/demo/friends-<timestamp>');
const dir = resolve(process.argv[2]);
const data = JSON.parse(await readFile(join(dir, 'friends-cues.json'), 'utf8'));
if (!data.success) throw new Error('Refusing to export an unverified capture as a completed demo');
for (const name of ['A', 'B']) {
  if (!data.checks[`player${name}VideoCalibrated`]) {
    throw new Error(`Player ${name} video needs visual synchronization before editing`);
  }
}
const font =
  process.platform === 'win32' ? "fontfile='C\\:/Windows/Fonts/segoeui.ttf'" : 'font=Sans';
const text = (value, x, y, size = 28) =>
  `drawtext=${font}:text='${value}':fontsize=${size}:fontcolor=white:box=1:boxcolor=0x07130f@0.94:boxborderw=14:x=${x}:y=${y}`;
function run(args) {
  return new Promise((done, fail) => {
    const proc = spawn(
      process.env.FFMPEG_PATH || 'ffmpeg',
      ['-hide_banner', '-loglevel', 'error', '-y', ...args],
      { cwd: dir, windowsHide: true, stdio: 'inherit' },
    );
    proc.on('error', fail);
    proc.on('exit', (code) => (code === 0 ? done() : fail(new Error(`FFmpeg exited ${code}`))));
  });
}
const maximumSeconds = [5, 5, 4, 3, 6, 6, 8, 6];
const edits = [];
for (const [index, shot] of data.shots.entries()) {
  const duration = shot.end - shot.start;
  const speed = Math.max(1, duration / maximumSeconds[index]);
  const names = shot.view === 'split' ? ['A', 'B'] : [shot.view];
  const inputs = names.flatMap((name) => {
    const offset = data.players.find((p) => p.name === name).videoStart;
    return [
      '-ss',
      String(Math.max(0, shot.start - offset)),
      '-t',
      String(duration),
      '-i',
      `player-${name}.webm`,
    ];
  });
  const filters = [];
  const montage = shot.name.startsWith('Remaining');
  for (const [input, name] of names.entries()) {
    let chain = `[${input}:v]setpts=(PTS-STARTPTS)/${speed},fps=30`;
    if (names.length === 2) {
      // Enlarge member/result panels. During the montage show both complete drafts.
      chain += montage
        ? ',crop=1400:980:260:90,scale=940:658,pad=960:1080:10:190:color=0x07130f'
        : ',crop=780:600:360:290,scale=900:692,pad=960:1080:30:160:color=0x07130f';
      chain += `,${text(`PLAYER ${name}${name === 'A' ? ' / HOST' : ' / FRIEND'}`, '(w-tw)/2', 48, 32)}`;
    } else {
      if (shot.name.includes('selection')) {
        chain +=
          ",zoompan=z='1+0.3*sin(PI*min(on,90)/90)':x='min(iw-iw/zoom,max(0,1280-iw/zoom/2))':y='min(ih-ih/zoom,max(0,400-ih/zoom/2))':d=1:s=1920x1080:fps=30";
      }
      chain += `,${text(`PLAYER ${name}${name === 'A' ? ' / HOST' : ' / FRIEND'}`, 30, 30, 24)}`;
    }
    filters.push(`${chain}[p${input}]`);
  }
  const source = names.length === 2 ? '[combined]' : '[p0]';
  if (names.length === 2) filters.push('[p0][p1]hstack=inputs=2[combined]');
  const title = montage ? 'Both players complete their drafts' : shot.name;
  filters.push(
    `${source}${text(title, '(w-tw)/2', 1005, 30)},${text(speed > 1.05 ? `${speed.toFixed(1)}x playback` : 'Real-time playback', 'w-tw-30', 65, 18)},${text('LIVE AGS GAMEPLAY', 'w-tw-30', 25, 18)}[out]`,
  );
  const file = `friends-shot-${index + 1}.mp4`;
  await run([
    ...inputs,
    '-filter_complex',
    filters.join(';'),
    '-map',
    '[out]',
    '-an',
    '-c:v',
    'libx264',
    '-preset',
    'fast',
    '-crf',
    '18',
    '-pix_fmt',
    'yuv420p',
    '-video_track_timescale',
    '15360',
    file,
  ]);
  edits.push({
    file,
    name: shot.name,
    sourceStart: shot.start,
    sourceDuration: duration,
    speed,
    view: shot.view,
  });
}
await writeFile(join(dir, 'friends-concat.txt'), edits.map((e) => `file '${e.file}'`).join('\n'));
await run([
  '-f',
  'concat',
  '-safe',
  '0',
  '-i',
  'friends-concat.txt',
  '-c',
  'copy',
  '-movflags',
  '+faststart',
  'friends-demo.mp4',
]);
await run([
  '-i',
  'friends-demo.mp4',
  '-filter_complex',
  '[0:v]fps=15,scale=1280:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle',
  '-frames:v',
  '999',
  '-loop',
  '0',
  'friends-demo.gif',
]);
await writeFile(join(dir, 'friends-edit.json'), JSON.stringify(edits, null, 2));
console.log(`MP4 and GIF exported: ${dir}`);
