import { exec } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

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

export async function POST(req) {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "caption-"));
  const tempVideoPath = path.join(workDir, "input.mp4");
  const assPath = path.join(workDir, "captions.ass");
  const outputPath = path.join(workDir, "output.mp4");

  try {
    const formData = await req.formData();
    const file = formData.get("video");
    const words = JSON.parse(formData.get("words") || "[]");
    const styles = JSON.parse(formData.get("styles") || "{}");

    if (!file || words.length === 0) {
      return Response.json({ success: false, error: "Missing data" }, { status: 400 });
    }

    if (words.length > 150) {
      return Response.json({ success: false, error: "Too many captions. Max 150 allowed." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(tempVideoPath, buffer);

    // ✅ Build ASS file
    const assContent = buildASS(words, styles);
    fs.writeFileSync(assPath, assContent, "utf8");
    console.log("ASS generated, words:", words.length);

    // ✅ Burn subtitles with FFmpeg - no PNG overlays
    const escapedAssPath = assPath.replace(/\\/g, "/").replace(/:/g, "\\:");

    await runCommand(
      `ffmpeg -i "${tempVideoPath}" -vf "ass='${escapedAssPath}'" -c:v libx264 -preset veryfast -crf 23 -c:a aac -b:a 128k -movflags +faststart "${outputPath}" -y`,
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

// ── ASS Helpers ───────────────────────────────────────────────────────────────

function hexToASS(hex = "#ffffff") {
  const h = hex.replace("#", "").padEnd(6, "0");
  return (h.slice(4, 6) + h.slice(2, 4) + h.slice(0, 2)).toUpperCase();
}

function formatASSTime(t) {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const cs = Math.round((t % 1) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function buildASS(words, styles) {
  const {
    fontSize = 40,
    fontColor = "#ffffff",
    fontFamily = "Noto Sans Sinhala",
    isBold = true,
    shadow = true,
    outlineSize = 2,
    showBackground = false,
    bgColor = "#000000",
    bgOpacity = 0.5,
    xPosition = 50,
    yPosition = 84,
    videoWidth = 1080,
    videoHeight = 1920,
  } = styles;

  const cleanFontFamily = String(fontFamily).replaceAll("'", "");
  const primaryColor = `&H00${hexToASS(fontColor)}`;
  const bold = isBold ? -1 : 0;
  const shadowVal = shadow ? 2 : 0;
  const outlineVal = shadow ? Math.max(1, outlineSize) : 0;

  const bgAlpha = Math.round((1 - bgOpacity) * 255).toString(16).padStart(2, "0").toUpperCase();
  const backColor = showBackground ? `&H${bgAlpha}${hexToASS(bgColor)}` : "&HFF000000";
  const borderStyle = showBackground ? 4 : 1;

  // Scale font size to video resolution
  const previewHeight = 640;
  const scaledFontSize = Math.round(fontSize * (videoHeight / previewHeight));

  const resX = videoWidth;
  const resY = videoHeight;

  // Convert % position to pixels
  const posX = Math.round((xPosition / 100) * resX);
  const posY = Math.round((yPosition / 100) * resY);

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${resX}
PlayResY: ${resY}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${cleanFontFamily},${scaledFontSize},${primaryColor},&H000000FF,&H00000000,${backColor},${bold},0,0,0,100,100,2,0,${borderStyle},${outlineVal},${shadowVal},2,30,30,30,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events = words.map((w) => {
   const pad = showBackground ? "\u00A0\u00A0\u00A0" : "";
const bord = showBackground ? `\\bord8` : `\\bord${outlineVal}`;
const text = `{\\pos(${posX},${posY})\\b1${bord}}${pad}${w.text}${pad}`;
    return `Dialogue: 0,${formatASSTime(w.start)},${formatASSTime(w.end)},Default,,0,0,0,,${text}`;
  }).join("\n");

  return header + events + "\n";
}