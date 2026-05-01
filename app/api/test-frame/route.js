import path from "path";
import { renderFrame } from "@/lib/renderFrame";

export async function GET() {
  const outputPath = path.join(process.cwd(), "test-caption.png");

  const html = `
    <html>
      <body style="margin:0;background:transparent;">
        <div style="
          width:1080px;
          height:1920px;
          display:flex;
          align-items:center;
          justify-content:center;
          background:transparent;
        ">
          <div style="
            font-size:80px;
            font-weight:900;
            color:white;
            background:#ff2d55;
            padding:30px 60px;
            border-radius:40px;
            font-family:Arial;
            text-shadow:0 0 8px black;
          ">
            SinhalaCaps Test
          </div>
        </div>
      </body>
    </html>
  `;

  await renderFrame(html, outputPath);

  return Response.json({
    success: true,
    message: "test-caption.png created in project root",
  });
}