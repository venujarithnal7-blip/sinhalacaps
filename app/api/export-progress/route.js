import { getProgress, deleteProgress } from "@/lib/progressStore";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  const stream = new ReadableStream({
    start(controller) {
      const interval = setInterval(() => {
        const progress = getProgress(id);
        controller.enqueue(`data: ${progress}\n\n`);

        if (progress >= 100) {
          clearInterval(interval);
          deleteProgress(id);
          controller.close();
        }
      }, 300);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}