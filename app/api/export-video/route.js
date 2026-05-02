import { exec, spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { renderFrame } from "@/lib/renderFrame";


// ── Runners ───────────────────────────────────────────────────────────────────

function runCommand(command, cwd) {
  return new Promise((resolve, reject) => {
    exec(command, { maxBuffer: 1024 * 1024 * 200, cwd }, (error, stdout, stderr) => {
      if (error) {
        console.error("FFmpeg stderr:", stderr);
        reject(new Error(stderr || error.message));
        return;
      }
      resolve(stdout);
    });
  });
}

function runFFmpegArgs(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args);

    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    proc.on("close", (code) => {
      if (code !== 0) {
        console.error("FFmpeg stderr:\n", stderr);
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-500)}`));
      } else {
        resolve();
      }
    });
  });
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(req) {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "caption-"));
  const framesDir = path.join(workDir, "frames");
  fs.mkdirSync(framesDir, { recursive: true });

  const tempVideoPath = path.join(workDir, "input.mp4");
  const assPath       = path.join(workDir, "subs.ass");
  const outputPath    = path.join(workDir, "output.mp4");

  try {
    const formData = await req.formData();
    const file   = formData.get("video");
    const words  = JSON.parse(formData.get("words")  || "[]");
    const styles = JSON.parse(formData.get("styles") || "{}");
    const mode   = formData.get("mode") || "normal";

    if (!file || words.length === 0) {
      return Response.json({ success: false, error: "Missing data" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(tempVideoPath, buffer);

    // ─── PRO MODE ────────────────────────────────────────────────
if (mode === "pro") {
  console.log("=== EXPORT DEBUG ===");
  console.log("videoWidth:", styles.videoWidth);
  console.log("videoHeight:", styles.videoHeight);
  console.log("xPosition:", styles.xPosition);
  console.log("yPosition:", styles.yPosition);
  console.log("fontSize:", styles.fontSize);
  console.log("===================");
  console.log("PRO EXPORT RUNNING");

  const vw = styles.videoWidth || 1080;
  const vh = styles.videoHeight || 1920;
  const posX = Math.round((styles.xPosition / 100) * vw);
  const posY = Math.round((styles.yPosition / 100) * vh);
  const previewContainerHeight = 640;
  const scaledFont = Math.round(styles.fontSize * (vh / previewContainerHeight));
  const paddingX = Math.round(16 * (vw / 360));
  const paddingY = Math.round(8 * (vh / 640));
  const scaledRadius = Math.round((styles.bgRadius || 12) * (vh / 640));

  const BATCH_SIZE = 1;
  const framePaths = [];

  for (let i = 0; i < words.length; i += BATCH_SIZE) {
    const batch = words.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(async (w, batchIndex) => {
        const index = i + batchIndex;

        const html = `
          <html>
            <head>
              <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                @keyframes pop {
                  0%   { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
                  60%  { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
                  80%  { transform: translate(-50%, -50%) scale(0.95); }
                  100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                }
                .caption { animation: pop 0.2s ease-out forwards; }
              </style>
            </head>
            <body style="margin:0;padding:0;background:transparent;overflow:hidden;">
              <div style="position:relative;width:${vw}px;height:${vh}px;">
                <div class="caption" style="
                  position:absolute;
                  left:${posX}px;
                  top:${posY}px;
                  font-size:${scaledFont}px;
                  font-weight:900;
                  -webkit-font-smoothing:antialiased;
                  font-synthesis:weight;
                  background:${styles.showBackground
                    ? `${styles.bgColor}${Math.round(styles.bgOpacity * 255).toString(16).padStart(2, '0')}`
                    : 'transparent'};
                  padding:${paddingY}px ${paddingX}px;
                  border-radius:${scaledRadius}px;
                  color:${styles.fontColor};
                  font-family:${styles.fontFamily};
                  text-shadow:${styles.shadow
                    ? `0 0 ${styles.outlineSize * 3}px black, 0 0 ${styles.outlineSize * 6}px black`
                    : 'none'};
                  white-space:nowrap;
                  text-align:center;
                  -webkit-text-stroke:${styles.isBold ? '0.5px ' + styles.fontColor : 'none'};
                ">${w.text}</div>
              </div>
            </body>
          </html>
        `;

        const framePath = path.join(framesDir, `frame-${index}.png`);

        try {
          await renderFrame(html, framePath, vw, vh);
          if (!fs.existsSync(framePath)) {
            throw new Error(`renderFrame did not create file: ${framePath}`);
          }
          console.log(`Frame ${index} created`);
        } catch (err) {
          throw new Error(`Failed to render frame ${index}: ${err.message}`);
        }

        return { path: framePath, start: w.start, end: w.end };
      })
    );

    framePaths.push(...batchResults);
    console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1} done`);
  }

  let filterParts = [];
  let last = "[0:v]";
for (let i = 0; i < framePaths.length; i++) {
  const f = framePaths[i];
  const out = `[v${i}]`;
  filterParts.push(
    `${last}[${i + 1}:v]overlay=0:0:enable='between(t,${f.start},${f.end})'${out}`
  );
  last = out;
}

  const filter = filterParts.join(";");
  const inputArgs = framePaths.flatMap((f) => ["-i", f.path]);

 await runFFmpegArgs([
  "-i", tempVideoPath,
  ...inputArgs,
  "-filter_complex", filter,
  "-map", last,
  "-map", "0:a",
  "-c:v", "libx264",
  "-preset", "fast",      // ← change slow to fast (less CPU)
  "-crf", "18",
  "-pix_fmt", "yuv420p",  // ← keep this
  "-c:a", "aac",
  "-b:a", "128k",
  "-movflags", "+faststart",
  outputPath, "-y",
]);

  const videoBuffer = fs.readFileSync(outputPath);
  return new Response(videoBuffer, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": 'attachment; filename="captioned.mp4"',
    },
  });
}

    // ─── NORMAL MODE (ASS) ───────────────────────────────────────
    const assContent = buildASS(words, styles);
    fs.writeFileSync(assPath, assContent, "utf8");
    console.log("ASS preview:\n", assContent.slice(0, 500));

    await runCommand(
      `ffmpeg -i "input.mp4" -vf "ass=subs.ass" -c:v libx264 -preset veryfast -crf 23 -c:a aac -b:a 128k -movflags +faststart "output.mp4" -y`,
      workDir
    );

    const videoBuffer = fs.readFileSync(outputPath);
    return new Response(videoBuffer, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": 'attachment; filename="captioned.mp4"',
      },
    });

  } catch (error) {
    console.error("Export error:", error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {}
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hexToASS(hex = "#ffffff") {
  const h = hex.replace("#", "").padEnd(6, "0");
  return (h.slice(4, 6) + h.slice(2, 4) + h.slice(0, 2)).toUpperCase();
}

function formatASSTime(t) {
  const h  = Math.floor(t / 3600);
  const m  = Math.floor((t % 3600) / 60);
  const s  = Math.floor(t % 60);
  const cs = Math.round((t % 1) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "00")}`;
}

function buildASS(words, styles) {
  const {
    fontSize       = 40,
    fontColor      = "#ffffff",
    fontFamily     = "Noto Sans Sinhala",
    isBold         = true,
    shadow         = true,
    outlineSize    = 2,
    showBackground = false,
    bgColor        = "#000000",
    bgOpacity      = 0.5,
    xPosition      = 50,
    yPosition      = 84,
    videoWidth     = 1920,
    videoHeight    = 1080,
  } = styles;

  const cleanFontFamily = String(fontFamily).replaceAll("'", "");
  const primaryColor    = `&H00${hexToASS(fontColor)}`;
  const bold            = isBold ? -1 : 0;
  const shadowVal       = shadow ? 1 : 0;
  const bgAlpha         = Math.round((1 - bgOpacity) * 255).toString(16).padStart(2, "0").toUpperCase();
  const backColor       = showBackground ? `&H${bgAlpha}${hexToASS(bgColor)}` : "&HFF000000";
  const outlineColor    = "&H00000000";
  const borderStyle     = showBackground ? 4 : 1;
  const exportOutline   = isBold ? 1 : outlineSize;
  const previewHeight   = 360;
  const scaledFontSize  = Math.round(fontSize * (videoHeight / previewHeight) * 1.12);
  const resX            = videoWidth;
  const resY            = videoHeight;
  const posX            = Math.round((xPosition / 100) * resX);
  const posY            = Math.round((yPosition / 100) * resY);

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${resX}
PlayResY: ${resY}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${cleanFontFamily},${scaledFontSize},${primaryColor},&H000000FF,${outlineColor},${backColor},${bold},0,0,0,100,100,0,0,${borderStyle},${exportOutline},${shadowVal},2,30,30,30,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events = words
    .map((w) => {
      const padSpaces = showBackground ? "\u00A0\u00A0" : "";
      const boxPad    = showBackground ? 5 : 0;
      const text      = `{\\pos(${posX},${posY})\\b1\\bord${boxPad}}${padSpaces}${w.text}${padSpaces}`;
      return `Dialogue: 0,${formatASSTime(w.start)},${formatASSTime(w.end)},Default,,0,0,0,,${text}`;
    })
    .join("\n");

  return header + events + "\n";
}