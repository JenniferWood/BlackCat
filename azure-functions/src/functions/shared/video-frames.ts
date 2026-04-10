import { FFmpeg } from '@ffmpeg/ffmpeg';

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

let ffmpegInstance: FFmpeg | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  const ffmpeg = new FFmpeg();
  await ffmpeg.load();
  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

export async function extractFrames(
  videoBuffer: Buffer,
  ext: string,
): Promise<{ duration: number; frames: Buffer[] }> {
  const ffmpeg = await getFFmpeg();
  const inputName = `input.${ext}`;

  await ffmpeg.writeFile(inputName, new Uint8Array(videoBuffer));

  // Get duration via a short probe run — extract to a single frame and read logs
  let duration = 0;
  ffmpeg.on('log', ({ message }) => {
    const match = message.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/);
    if (match) {
      duration =
        parseInt(match[1]) * 3600 +
        parseInt(match[2]) * 60 +
        parseInt(match[3]) +
        parseInt(match[4]) / 100;
    }
  });

  // Probe: extract 1 frame just to trigger duration log
  await ffmpeg.exec(['-i', inputName, '-frames:v', '1', '-f', 'null', '-']);

  if (duration <= 0) {
    // Fallback: try to get duration from format info
    duration = 10; // conservative default
  }

  const count = getFrameCount(duration);
  const timestamps = getTimestamps(duration, count);
  const frames: Buffer[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    const outName = `frame_${i}.jpg`;
    await ffmpeg.exec([
      '-ss', String(timestamps[i]),
      '-i', inputName,
      '-frames:v', '1',
      '-vf', 'scale=512:-1',
      '-q:v', '2',
      '-f', 'image2',
      outName,
    ]);

    try {
      const data = await ffmpeg.readFile(outName);
      frames.push(Buffer.from(data as Uint8Array));
      await ffmpeg.deleteFile(outName);
    } catch {
      // Frame extraction at this timestamp failed, skip
    }
  }

  await ffmpeg.deleteFile(inputName);

  return { duration, frames };
}
