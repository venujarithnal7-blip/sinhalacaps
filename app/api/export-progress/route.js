import { getProgress, deleteProgress } from "@/lib/progressStore";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  const stream = new ReadableStream({
    start(controller) {
      const interval = setInterval(() => {
        try {
          const progress = getProgress(id);
          controller.enqueue(`data: ${progress}\n\n`);

          if (progress >= 100) {
            clearInterval(interval);
            deleteProgress(id);
            try { controller.close(); } catch {}
          }
        } catch {
          // ✅ Stream already closed - just stop
          clearInterval(interval);
        }
      }, 300);

      // ✅ Clean up if client disconnects
      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        try { controller.close(); } catch {}
      });
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