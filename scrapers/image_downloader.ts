import * as cheerio from "cheerio";
import sharp from "sharp";

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

// Download image helper with optional compression
async function downloadImage(url: string, destPath: string, isGif: boolean): Promise<boolean> {
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
    const uint8Array = new Uint8Array(buffer);

    if (isGif) {
      // Keep original GIF format to preserve animations
      await Deno.writeFile(destPath, uint8Array);
    } else {
      try {
        // Compress and convert to webp format
        await sharp(uint8Array)
          .webp({ quality: 80 })
          .toFile(destPath);
      } catch (sharpErr) {
        console.warn(`      ⚠️ Sharp compression failed for ${url}, falling back to original image:`, sharpErr);
        // Fallback: save original image data directly
        await Deno.writeFile(destPath, uint8Array);
      }
    }
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

      let ext = "webp";
      let isGif = false;
      try {
        const pathname = new URL(src).pathname.toLowerCase();
        if (pathname.endsWith(".gif")) {
          ext = "gif";
          isGif = true;
        }
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
        downloaded = await downloadImage(src, destPath, isGif);
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

