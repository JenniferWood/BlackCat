import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink, mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const execFileAsync = promisify(execFile);

export const MAX_VIDEO_SIZE_MB = 100;

export function getFrameCount(durationSeconds: number): number {
  if (durationSeconds < 5) return 2;
  if (durationSeconds <= 15) return 3;
  if (durationSeconds <= 30) return 5;
  if (durationSeconds <= 60) return 7;
  return 10;
}

function getTimestamps(duration: number, count: number): number[] {
  if (count <= 1) return [0];
  const step = duration / (count + 1);
  return Array.from({ length: count }, (_, i) => Math.round((i + 1) * step * 100) / 100);
}

async function getDuration(inputPath: string): Promise<number> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'csv=p=0',
    inputPath,
  ]);
  const duration = parseFloat(stdout.trim());
  return isNaN(duration) ? 10 : duration;
}

export async function extractFrames(
  videoBuffer: Buffer,
  ext: string,
): Promise<{ duration: number; frames: Buffer[] }> {
  const tempDir = await mkdtemp(join(tmpdir(), 'pidan-'));
  const inputPath = join(tempDir, `input.${ext}`);

  try {
    await writeFile(inputPath, videoBuffer);

    const duration = await getDuration(inputPath);
    const count = getFrameCount(duration);
    const timestamps = getTimestamps(duration, count);
    const frames: Buffer[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const outPath = join(tempDir, `frame_${i}.jpg`);
      try {
        await execFileAsync('ffmpeg', [
          '-ss', String(timestamps[i]),
          '-i', inputPath,
          '-frames:v', '1',
          '-vf', 'scale=512:-1',
          '-q:v', '2',
          '-y',
          outPath,
        ]);
        const data = await readFile(outPath);
        frames.push(data);
        await unlink(outPath).catch(() => {});
      } catch {
        // Frame extraction at this timestamp failed, skip
      }
    }

    return { duration, frames };
  } finally {
    await unlink(inputPath).catch(() => {});
  }
}
