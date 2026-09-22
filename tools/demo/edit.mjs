import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';

if (!process.argv[2])
  throw new Error('Usage: npm run demo:edit -- artifacts/demo/<capture-directory>');
const dir = resolve(process.argv[2]);
const data = JSON.parse(await readFile(join(dir, 'cues.json'), 'utf8'));
const cue = (name) => {
  const value = data.cues.find((c) => c.name === name);
  if (!value) throw new Error(`Missing cue: ${name}`);
  return value;
};
function ffmpeg(args) {
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
// Font file syntax is escaped for the FFmpeg filter parser, not a shell.
const font =
  process.platform === 'win32' ? "fontfile='C\\:/Windows/Fonts/segoeui.ttf'" : 'font=Sans';
const caption = (text) =>
  `drawtext=${font}:text='${text}':fontsize=28:fontcolor=white:box=1:boxcolor=0x07130f@0.92:boxborderw=18:x=(w-tw)/2:y=h-th-38`;
const shots = [
  ['opening', 'selection-focus', 1, 'Build your Football 11', false],
  ['selection-focus', 'placement', 1, 'Choose a player - compare position ratings', true],
  ['placement', 'draft-montage', 1, 'Place the player in a highlighted position', false],
  ['draft-montage', 'lineup', 3, 'Remaining draft - 3x speed', false],
  ['lineup', 'end', 1, 'Eleven real picks. Your completed XI.', false],
];
const edl = [];
for (const [index, [from, to, speed, title, zoom]] of shots.entries()) {
  const start = cue(from).seconds;
  const duration = cue(to).seconds - start;
  const frames = Math.max(2, Math.round(duration * 30));
  const box = cue('selection-focus').box;
  const filters = ['setpts=PTS-STARTPTS', 'fps=30'];
  if (zoom)
    filters.push(
      `zoompan=z='1+0.42*sin(PI*on/${frames - 1})':x='min(iw-iw/zoom,max(0,${box.x + box.width / 2}-iw/zoom/2))':y='min(ih-ih/zoom,max(0,${box.y + box.height / 2}-ih/zoom/2))':d=1:s=1920x1080:fps=30`,
    );
  filters.push(`setpts=PTS/${speed}`, 'fps=30', caption(title));
  filters.push(
    `drawtext=${font}:text='LOCAL DEMO / OFFLINE':fontsize=18:fontcolor=white:box=1:boxcolor=0x07130f@0.92:boxborderw=10:x=w-tw-30:y=24`,
  );
  const file = `shot-${index + 1}.mp4`;
  await ffmpeg([
    '-ss',
    String(start),
    '-t',
    String(duration),
    '-i',
    'raw.webm',
    '-an',
    '-vf',
    filters.join(','),
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
  edl.push({ file, sourceStart: start, sourceDuration: duration, speed, title, zoom });
}
await writeFile(join(dir, 'concat.txt'), edl.map((shot) => `file '${shot.file}'`).join('\n'));
await ffmpeg([
  '-f',
  'concat',
  '-safe',
  '0',
  '-i',
  'concat.txt',
  '-c',
  'copy',
  '-movflags',
  '+faststart',
  'draft-demo.mp4',
]);
await writeFile(join(dir, 'edit.json'), JSON.stringify(edl, null, 2));
console.log(`Edited video: ${join(dir, 'draft-demo.mp4')}`);
