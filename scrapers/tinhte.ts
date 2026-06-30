import * as cheerio from "cheerio";
import { Post, Scraper } from "../types.ts";
import { COMMON_HEADERS } from "./constants.ts";

async function sha256(str: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export class TinhteScraper implements Scraper {
  source = "Tinhte" as const;

  async fetchPosts(): Promise<Post[]> {
    const url = "https://tinhte.vn/";
    const response = await fetch(url, { headers: COMMON_HEADERS });

    if (!response.ok) {
      throw new Error(`Failed to fetch Tinh te homepage: Status ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const posts: Post[] = [];

    const articles = $("[class*='latest-threads'] article, .latest-threads article").toArray();
    let index = 0;
    for (const art of articles) {
      const $art = $(art);
      const linkEl = $art.find("a[href*='/thread/']").first();
      let postUrl = linkEl.attr("href")?.trim() || "";
      if (!postUrl) continue;

      if (!postUrl.startsWith("http")) {
        postUrl = `https://tinhte.vn${postUrl}`;
      }

      // Lọc bỏ các link trùng lặp hoặc link rác nếu có
      if (posts.some(p => p.url === postUrl)) continue;

      const titleLink = $art.find("a[href*='/thread/']").filter((_, el) => $(el).text().trim().length > 0).first();
      const title = titleLink.attr("title")?.trim() || titleLink.text().trim();
      if (!title) continue;

      const author = $art.find(".author, [data-author], a.username").first().text().trim() || "Tinh tế";
      
      const summary = $art.find(".excerpt").text().trim();

      // Trích xuất thread ID từ URL
      let threadId = "";
      const match = postUrl.match(/\.(\d+)\/?$/);
      if (match) {
        threadId = match[1];
      } else {
        threadId = await sha256(postUrl);
      }
      const id = `tt-${threadId}`;

      // Tinh tế homepage không hiển thị timestamp chính xác,
      // Ta gán createdAt lùi dần để duy trì thứ tự hiển thị chính xác của tin
      const createdAt = Date.now() - index * 60 * 1000;
      index++;

      posts.push({
        id,
        title,
        url: postUrl,
        source: this.source,
        author,
        createdAt,
        summary: summary.slice(0, 200) + (summary.length > 200 ? "..." : "")
      });
    }

    return posts;
  }

  async fetchContent(url: string): Promise<string> {
    const response = await fetch(url, { headers: COMMON_HEADERS });

    if (!response.ok) {
      throw new Error(`Failed to fetch Tinh te thread: Status ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Find the main article container (which contains all parts of the thread starter's post in layout 1)
    let bodies = $();
    const articleEl = $("article.content, article").first();
    if (articleEl.length) {
      bodies = articleEl.find(".xfBody, .xf-body");
    }

    // Fallback: if no article container or no xfBody inside it, just use the first xfBody on the page (layout 2)
    if (!bodies.length) {
      const firstBody = $(".xfBody, .xf-body").first();
      if (firstBody.length) {
        bodies = firstBody;
      }
    }

    if (!bodies.length) {
      throw new Error("Could not find post content (.xfBody)");
    }

    // Clean garbage in all xfBody elements inside the selected bodies
    bodies.find("script, style, iframe, .ad-wrapper, .adsbygoogle, .social-share, .button-row, .reaction-bar").remove();

    let cleanHtml = "";
    bodies.each((i, el) => {
      const bodyHtml = $(el).html() || "";
      if (i > 0) {
        cleanHtml += `<hr class="thread-post-separator" style="border: 0; border-top: 1px dashed var(--border-color); margin: 24px 0;" />`;
      }
      cleanHtml += bodyHtml;
    });

    return cleanHtml;
  }
}
