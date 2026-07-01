import * as cheerio from "cheerio";
import { Post, Scraper } from "../types.ts";
import { COMMON_HEADERS } from "./constants.ts";

async function sha256(str: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export class WindowsCentralScraper implements Scraper {
  source = "WindowsCentral" as const;

  async fetchPosts(): Promise<Post[]> {
    const url = "https://www.windowscentral.com/rss.xml";
    const response = await fetch(url, { headers: COMMON_HEADERS });

    if (!response.ok) {
      throw new Error(`Failed to fetch Windows Central RSS: Status ${response.status}`);
    }

    const xml = await response.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    const posts: Post[] = [];

    const items = $("item").toArray();
    for (const item of items) {
      const $item = $(item);
      const postUrl = $item.find("link").text().trim();
      if (!postUrl) continue;

      const title = $item.find("title").text().trim();
      if (!title) continue;

      const author = $item.find("dc\\:creator, creator").text().trim() || $item.find("dc:creator").text().trim() || "Windows Central";
      
      const pubDateText = $item.find("pubDate").text().trim();
      const createdAt = pubDateText ? Date.parse(pubDateText) : Date.now();

      const description = $item.find("description").text().trim();
      const summary = cheerio.load(description).text().trim();

      // Trích xuất slug URL làm ID bài viết
      let slug = "";
      try {
        const pathParts = new URL(postUrl).pathname.split("/").filter(Boolean);
        slug = pathParts[pathParts.length - 1];
      } catch {
        slug = await sha256(postUrl);
      }
      const id = `wc-${slug}`;

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
      throw new Error(`Failed to fetch Windows Central article: Status ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const contentEl = $("#article-body, .article-body").first();

    if (!contentEl.length) {
      throw new Error("Could not find article body (#article-body)");
    }

    // Loại bỏ các thẻ thừa, quảng cáo, share links
    contentEl.find("script, style, iframe, .ad-wrapper, .adsbygoogle, .pop-under, .social-share, .newsletter-signup, #utility-bar, .utility-bar").remove();
    // Loại bỏ phần quảng cáo reddit và hình ảnh đi kèm
    contentEl.find("a[href*='reddit.com/r/windowscentral'], p:has(a[href*='reddit.com/r/windowscentral'])").remove();
    const cleanHtml = contentEl.html() || "";

    return cleanHtml;
  }
}
