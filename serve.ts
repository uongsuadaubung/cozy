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

Deno.serve({ port: PORT }, async (req) => {
  const url = new URL(req.url);
  let pathname = url.pathname;

  // Route root/empty paths to index.html
  if (pathname === "/" || pathname === "") {
    pathname = "/index.html";
  }

  let filepath = "./dist" + pathname;
  if (pathname === "/data.json") {
    filepath = "./data.json";
  } else if (pathname === "/sources.json") {
    filepath = "./sources.json";
  }

  try {
    const file = await Deno.open(filepath, { read: true });

    // Detect basic MIME content-types
    let contentType = "text/plain; charset=utf-8";
    if (filepath.endsWith(".html")) contentType = "text/html; charset=utf-8";
    else if (filepath.endsWith(".json")) {
      contentType = "application/json; charset=utf-8";
    } else if (filepath.endsWith(".css")) {
      contentType = "text/css; charset=utf-8";
    } else if (filepath.endsWith(".js")) {
      contentType = "application/javascript; charset=utf-8";
    }

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
