import { exec } from "child_process";

export async function GET() {
  return new Promise((resolve) => {
    exec("which ffmpeg && ffmpeg -version", (error, stdout, stderr) => {
      resolve(Response.json({
        error: error?.message,
        stdout,
        stderr: stderr?.slice(0, 200),
        path: process.env.PATH,
      }));
    });
  });
}