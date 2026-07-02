let PORT = Number(Deno.args[0]) || 8000;

// Auto-scan for a free port if the default 8000 is occupied
while (true) {
  try {
    const listener = Deno.listen({ port: PORT, transport: "tcp" });
    listener.close();
    break;
  } catch (err) {
    if (err instanceof Deno.errors.AddrInUse && !Deno.args[0]) {
      PORT++;
      continue;
    }
    throw err;
  }
}

console.log("-----------------------------------------");
console.log("☕ Cozy Feed Local Static Server");
console.log(`🌍 Đang chạy tại: http://localhost:${PORT}`);
console.log("-----------------------------------------");

const ROOT_SERVED_FILES = new Set([
  "/data.json",
  "/sources.json",
  "/sync_meta.json",
]);

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

Deno.serve({ port: PORT }, async (req) => {
  const url = new URL(req.url);
  let pathname = url.pathname;

  // Route root/empty paths to index.html
  if (pathname === "/" || pathname === "") {
    pathname = "/index.html";
  }

  // Serve static files from root directory for data or images; otherwise serve from ./dist
  const serveFromRoot = pathname.startsWith("/images/") ||
    ROOT_SERVED_FILES.has(pathname);
  const filepath = serveFromRoot ? `.${pathname}` : `./dist${pathname}`;

  try {
    const file = await Deno.open(filepath, { read: true });

    // Detect MIME content-type using object lookup
    const ext = filepath.substring(filepath.lastIndexOf("."));
    const contentType = MIME_TYPES[ext] || "text/plain; charset=utf-8";

    return new Response(file.readable, {
      headers: { "content-type": contentType },
    });
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      console.warn(
        `⚠️  404: Không tìm thấy tệp: ${filepath} (Hãy chắc chắn bạn đã chạy 'deno task build' trước đó)`,
      );
      return new Response(
        "Not Found (Hãy chạy 'deno task build' trước khi truy cập)",
        { status: 404 },
      );
    }
    console.error(`❌ Lỗi hệ thống khi đọc tệp ${filepath}:`, err);
    return new Response("Internal Server Error", { status: 500 });
  }
});
