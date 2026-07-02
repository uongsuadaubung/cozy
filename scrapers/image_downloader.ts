import * as cheerio from "cheerio";

// Helper to hash URL to a unique filename using native Web Crypto API
async function hashUrl(url: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(url);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return hashHex;
}

// Download image helper
async function downloadImage(url: string, destPath: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": new URL(url).origin,
      },
    });
    if (!res.ok) return false;
    const buffer = await res.arrayBuffer();
    await Deno.writeFile(destPath, new Uint8Array(buffer));
    return true;
  } catch (err) {
    console.error(`      ❌ Error downloading image ${url}:`, err);
    return false;
  }
}

// Process images inside HTML content by downloading them and rewriting src
export async function processPostImages(
  content: string,
  _postId: string,
): Promise<string> {
  if (!content) return content;

  try {
    const $ = cheerio.load(content);
    let modified = false;

    // Ensure images directory exists
    await Deno.mkdir("./images", { recursive: true });

    const imgElements = $("img").toArray();
    for (const el of imgElements) {
      const $img = $(el);
      const src = $img.attr("src") || $img.attr("k-data-src") ||
        $img.attr("data-src");
      if (!src) continue;

      if (!src.startsWith("http")) continue;

      let ext = "jpg";
      try {
        const pathname = new URL(src).pathname;
        if (pathname.endsWith(".png")) ext = "png";
        else if (pathname.endsWith(".webp")) ext = "webp";
        else if (pathname.endsWith(".gif")) ext = "gif";
        else if (pathname.endsWith(".jpeg")) ext = "jpeg";
      } catch (_) {
        // ignore pathname parsing errors
      }

      const hash = await hashUrl(src);
      const filename = `${hash}.${ext}`;
      const destPath = `./images/${filename}`;

      let downloaded = false;
      try {
        await Deno.stat(destPath);
        downloaded = true; // Already exists
      } catch (_) {
        console.log(`      [IMG] Downloading image: ${src.slice(0, 60)}...`);
        downloaded = await downloadImage(src, destPath);
      }

      if (downloaded) {
        const localPath = `images/${filename}`;
        $img.attr("src", localPath);
        $img.removeAttr("k-data-src");
        $img.removeAttr("data-src");
        $img.removeAttr("srcset");
        modified = true;
      }
    }

    return modified ? ($("body").html() || content) : content;
  } catch (err) {
    console.error(`   ⚠️ Failed to process images:`, err);
    return content;
  }
}
