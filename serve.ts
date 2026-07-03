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
// Helper to automatically download data.json and sync_meta.json from remote 'data' branch if missing locally
async function ensureLocalDataFile() {
  const DATA_FILE_PATH = "./data.json";
  try {
    await Deno.stat(DATA_FILE_PATH);
  } catch (_) {
    console.log("data.json not found locally. Attempting to fetch from remote 'data' branch...");
    try {
      const command = new Deno.Command("git", {
        args: ["remote", "get-url", "origin"],
      });
      const { success, stdout } = await command.output();
      if (!success) {
        throw new Error("Failed to get git remote URL.");
      }
      const remoteUrl = new TextDecoder().decode(stdout).trim();
      const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^.]+)/);
      if (match) {
        const [_, username, repoName] = match;
        const dataUrl = `https://raw.githubusercontent.com/${username}/${repoName}/data/data.json`;
        const metaUrl = `https://raw.githubusercontent.com/${username}/${repoName}/data/sync_meta.json`;
        
        console.log(`Fetching remote data.json from ${dataUrl}...`);
        const dataRes = await fetch(dataUrl);
        if (dataRes.ok) {
          const dataText = await dataRes.text();
          await Deno.writeTextFile(DATA_FILE_PATH, dataText);
          console.log("Successfully fetched and saved remote data.json!");
        } else {
          console.warn(`Failed to fetch data.json: Status ${dataRes.status}`);
        }

        console.log(`Fetching remote sync_meta.json from ${metaUrl}...`);
        const metaRes = await fetch(metaUrl);
        if (metaRes.ok) {
          const metaText = await metaRes.text();
          await Deno.writeTextFile("./sync_meta.json", metaText);
          console.log("Successfully fetched and saved remote sync_meta.json!");
        }
      } else {
        console.warn("Could not parse repository owner/name from remote URL:", remoteUrl);
      }
    } catch (err) {
      console.warn("Could not automatically fetch data.json from remote:", err);
    }
  }
}

// Call ensureLocalDataFile before starting the server
await ensureLocalDataFile();

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
