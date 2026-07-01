import * as cheerio from "cheerio";
import { Post, Scraper } from "../types.ts";
import { COMMON_HEADERS } from "./constants.ts";

export class WindowsLatestScraper implements Scraper {
  source = "WindowsLatest" as const;

  async fetchPosts(): Promise<Post[]> {
    const url = "https://www.windowslatest.com";
    const response = await fetch(url, { headers: COMMON_HEADERS });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch Windows Latest homepage: Status ${response.status}`,
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const posts: Post[] = [];

    // Chọn các khối bài viết trên trang chủ
    $(".td-module-container, .td_module_wrap").each((_index, element) => {
      const $el = $(element);
      const titleLink = $el.find(".entry-title a, h3 a, h2 a").first();
      const href = titleLink.attr("href");
      const title = titleLink.text().trim();

      if (!href || !title) return;

      // Chỉ lấy các URL thuộc trang Windows Latest và là bài viết (có dạng /2026/...)
      if (posts.some((p) => p.url === href)) return;
      if (!href.startsWith("https://www.windowslatest.com/20")) return;

      const author = $el.find(".td-post-author-name a").first().text().trim() ||
        "Windows Latest";

      const timeEl = $el.find("time").first();
      const dateText = timeEl.attr("datetime") || timeEl.text().trim() ||
        $el.find(".td-post-date").text().trim();
      const createdAt = dateText ? Date.parse(dateText) : Date.now();

      const summary = $el.find(".td-excerpt, .entry-summary").first().text()
        .trim();

      // Trích xuất slug URL làm ID
      let slug = "";
      try {
        const pathParts = new URL(href).pathname.split("/").filter(Boolean);
        slug = pathParts[pathParts.length - 1];
      } catch {
        slug = title;
      }

      posts.push({
        id: `wl-${slug}`,
        title,
        url: href,
        source: this.source,
        author,
        createdAt,
        summary: summary.slice(0, 200) + (summary.length > 200 ? "..." : ""),
      });
    });

    return posts;
  }

  async fetchContent(url: string): Promise<string> {
    const response = await fetch(url, { headers: COMMON_HEADERS });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch Windows Latest article: Status ${response.status}`,
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const contentEl = $(".td-post-content").first();

    // Loại bỏ các tag thừa trong nội dung bài viết
    contentEl.find(
      "script, style, iframe, .wp-block-embed, .td-post-source-tags, .adsbygoogle",
    ).remove();
    const cleanHtml = contentEl.html() || "";

    return cleanHtml;
  }
}
