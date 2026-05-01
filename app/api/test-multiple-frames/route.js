import path from "path";
import fs from "fs";
import { renderFrame } from "@/lib/renderFrame";

export async function GET() {
  const framesDir = path.join(process.cwd(), "test-frames");

  if (!fs.existsSync(framesDir)) {
    fs.mkdirSync(framesDir);
  }

  const words = [
    { text: "Hello World" },
    { text: "SinhalaCaps Working" },
    { text: "Pro Export Test" },
  ];

  for (let i = 0; i < words.length; i++) {
    const html = `
      <html>
        <body style="margin:0;background:transparent;">
          <div style="
            width:1080px;
            height:1920px;
            display:flex;
            justify-content:center;
            align-items:flex-end;
            padding-bottom:200px;
          ">
            <div style="
              font-size:80px;
              font-weight:900;
              color:white;
              background:#ff2d55;
              padding:20px 40px;
              border-radius:30px;
            ">
              ${words[i].text}
            </div>
          </div>
        </body>
      </html>
    `;

    const outputPath = path.join(framesDir, `frame-${i}.png`);

    await renderFrame(html, outputPath);
  }

  return Response.json({
    success: true,
    message: "frames created in /test-frames",
  });
}