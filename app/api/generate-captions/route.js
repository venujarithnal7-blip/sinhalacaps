import { exec } from "child_process";
import fs from "fs";
import path from "path";
import OpenAI from "openai";


function runCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve(stdout);
    });
  });
}

function detectLanguage(text) {
  const sinhalaPattern = /[\u0D80-\u0DFF]/;
  return sinhalaPattern.test(text) ? "si" : "en";
}

// ── ENGLISH: real word-level timestamps from whisper-1 ──────────────────────
// whisper-1 with language:"en" forced never misdetects language.
// Groups into 1-word captions (occasionally 2 if a word is very short).
function buildEnglishCaptions(whisperWords) {
  const clean = whisperWords.filter((w) => w.word && w.word.trim().length > 0);
  const captions = [];
  let id = 1;

  // Shift captions earlier than the actual word timestamp.
  // The brain needs ~150ms to read a word after seeing it, so captions
  // must appear slightly before the word is spoken to feel in sync.
  const EARLY_SHIFT = 0.25;

  for (let i = 0; i < clean.length; i++) {
    const w = clean[i];
    const next = clean[i + 1];

    const rawStart = i === 0 ? 0 : (w.start ?? 0);
    let rawEnd = w.end ?? rawStart + 0.3;

    // Bridge gap to next word if silence is under 1.5s.
   if (next) {
  const nextStart = next.start ?? rawEnd;
  const gap = nextStart - rawEnd;

  if (gap > 0 && gap < 0.8) {
    rawEnd = nextStart;
  }

  if (gap >= 0.8) {
    rawEnd = rawEnd + 0.15;
  }
}

    // Apply early shift — clamp start to 0 so first word never goes negative
    const start = Math.max(0, rawStart - EARLY_SHIFT);
    const end = Math.max(start + 0.1, rawEnd - EARLY_SHIFT);

    captions.push({
      id: id++,
      text: w.word.trim(),
      start,
      end,
    });
  }

  return captions;
}

// ── SINHALA: segment-based proportional timing (unchanged) ──────────────────
function wordWeight(word) {
  const cleaned = word.trim();
  if (!cleaned) return 1;
  return Math.max(1, [...cleaned].length);
}

function splitSegmentIntoPairs(segmentText, segStart, segEnd, startId) {
  const words = segmentText.split(/\s+/).map((w) => w.trim()).filter(Boolean);
  if (words.length === 0) return [];

  const segDuration = segEnd - segStart;
  const pairs = [];
  for (let i = 0; i < words.length; i += 2) {
    pairs.push(words.slice(i, i + 2));
  }

  const totalWeight = words.reduce((sum, w) => sum + wordWeight(w), 0) || 1;
  const pairWeights = pairs.map((pw) => pw.reduce((sum, w) => sum + wordWeight(w), 0));

  const result = [];
  let currentTime = segStart;
  let id = startId;

  for (let i = 0; i < pairs.length; i++) {
    const isLast = i === pairs.length - 1;
    const duration = (pairWeights[i] / totalWeight) * segDuration;
    const pairStart = currentTime;
    const pairEnd = isLast ? segEnd : currentTime + duration;

    result.push({ id: id++, text: pairs[i].join(" "), start: pairStart, end: pairEnd });
    currentTime = pairEnd;
  }

  return result;
}

function alignFullTextToSegments(fullText, segments) {
  const fullWords = fullText.split(/\s+/).map((w) => w.trim()).filter(Boolean);
  if (fullWords.length === 0) return segments.map(() => "");

  const segCharCounts = segments.map((s) => Math.max(1, [...String(s.text || "").trim()].length));
  const totalChars = segCharCounts.reduce((sum, c) => sum + c, 0) || 1;

  let cursor = 0;
  const mapped = [];

  for (let i = 0; i < segments.length; i++) {
    const isLast = i === segments.length - 1;
    const takeCount = isLast
      ? fullWords.length - cursor
      : Math.max(1, Math.round((segCharCounts[i] / totalChars) * fullWords.length));

    mapped.push(fullWords.slice(cursor, cursor + takeCount).join(" ").trim());
    cursor += takeCount;
  }

  if (cursor < fullWords.length && mapped.length > 0) {
    mapped[mapped.length - 1] = (mapped[mapped.length - 1] + " " + fullWords.slice(cursor).join(" ")).trim();
  }

  return mapped.map((text, index) => text || String(segments[index].text || "").trim());
}

export async function POST(req) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "placeholder",
  });
  
  let tempVideoPath = "";
  let tempAudioPath = "";
  // rest of your code...

  try {
    const formData = await req.formData();
    const file = formData.get("video");

    if (!file) {
      return Response.json({ success: false, error: "No video uploaded" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const unique = Date.now();
    tempVideoPath = path.join(process.cwd(), `temp-video-${unique}.mp4`);
    tempAudioPath = path.join(process.cwd(), `temp-audio-${unique}.mp3`);

    fs.writeFileSync(tempVideoPath, buffer);

    await runCommand(
      `ffmpeg -i "${tempVideoPath}" -vn -acodec libmp3lame -q:a 2 -ar 16000 -ac 1 -af loudnorm "${tempAudioPath}" -y`
    );

    // Step 1: detect language
    const detectionRes = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempAudioPath),
      model: "gpt-4o-transcribe",
      response_format: "text",
    });

    const detectedLang = detectLanguage(String(detectionRes || ""));
    const isSinhala = detectedLang === "si";

    let normalised = [];
    let fullText = "";

    if (!isSinhala) {
      // ── ENGLISH PATH ────────────────────────────────────────────────────────
      // whisper-1 with language:"en" forced + word timestamps.
      // This gives real per-word start/end times — no estimation needed.
      const whisperRes = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempAudioPath),
        model: "whisper-1",
        response_format: "verbose_json",
        timestamp_granularities: ["word"],
        language: "en",
        prompt:
          "This is a clear spoken English video. Transcribe every word accurately " +
          "with correct spelling and punctuation. Do not skip or summarize any words.",
      });

      fullText = whisperRes.text ?? "";
      const rawWords = whisperRes.words ?? [];

      if (rawWords.length === 0) {
        return Response.json({ success: false, error: "No word timestamps returned" });
      }

      normalised = buildEnglishCaptions(rawWords);

    } else {
      // ── SINHALA PATH (unchanged) ─────────────────────────────────────────────
      const fullTextRes = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempAudioPath),
        model: "gpt-4o-transcribe",
        response_format: "text",
      });

      const diarizedRes = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempAudioPath),
        model: "gpt-4o-transcribe-diarize",
        response_format: "diarized_json",
        chunking_strategy: "auto",
      });

      fullText = String(fullTextRes || "").trim();
      const segments = Array.isArray(diarizedRes.segments) ? diarizedRes.segments : [];

      if (segments.length === 0) {
        return Response.json({ success: false, error: "No timestamped segments returned" });
      }

      const matchedParts = alignFullTextToSegments(fullText, segments);

      let idCounter = 1;
      const allCaptions = [];

      for (let segIndex = 0; segIndex < segments.length; segIndex++) {
        const segment = segments[segIndex];
        const segmentText = String(matchedParts[segIndex] || "").trim();
        const start = Number(segment.start);
        const end = Number(segment.end);

        if (!segmentText || Number.isNaN(start) || Number.isNaN(end) || end <= start) continue;

        const pairs = splitSegmentIntoPairs(segmentText, start, end, idCounter);
        idCounter += pairs.length;
        allCaptions.push(...pairs);
      }

      if (allCaptions.length === 0) {
        return Response.json({ success: false, error: "No captions generated" });
      }

      normalised = allCaptions.map((item, index) => {
        let { start, end } = item;
        if (index === 0) start = 0;
        if (end <= start) end = start + 0.3;
        return { ...item, start, end };
      });
    }

    return Response.json({
      success: true,
      text: fullText,
      words: normalised,
      language: detectedLang,
    });
  } catch (error) {
    console.error("generate-captions error:", error);
    return Response.json(
      { success: false, error: error.message || "Caption generation failed" },
      { status: 500 }
    );
  } finally {
    try {
      if (tempVideoPath && fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
      if (tempAudioPath && fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
    } catch (cleanupError) {
      console.error("cleanup error:", cleanupError);
    }
  }
}