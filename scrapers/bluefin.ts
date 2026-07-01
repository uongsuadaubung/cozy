import * as cheerio from "cheerio";
import { Post, Scraper } from "../types.ts";
import { COMMON_HEADERS } from "./constants.ts";

export class BluefinScraper implements Scraper {
  source = "Bluefin" as const;

  async fetchPosts(): Promise<Post[]> {
    const url = "https://docs.projectbluefin.io/blog/";
    const response = await fetch(url, {
      headers: COMMON_HEADERS,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch Project Bluefin blog: Status ${response.status}`,
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const posts: Post[] = [];

    // Chọn danh sách bài viết từ các thẻ <article> của Docusaurus
    $("article").each((index, element) => {
      const $el = $(element);
      const titleLink = $el.find("h2 a, h1 a").first();
      const href = titleLink.attr("href");

      if (!href) return;

      const title = titleLink.text().trim();
      if (!title) return;

      const summary = $el.find("p").first().text().trim();

      // Chuyển relative URL sang absolute URL
      const postUrl = href.startsWith("http")
        ? href
        : `https://docs.projectbluefin.io${href}`;

      // Trích xuất ID duy nhất từ slug URL (ví dụ: /blog/introducing-knuckle/ -> bluefin-introducing-knuckle)
      const idMatch = postUrl.match(/\/blog\/([^\/]+)\/?$/);
      const id = idMatch
        ? `bluefin-${idMatch[1]}`
        : `bluefin-${encodeURIComponent(postUrl).slice(-20)}`;

      // Trích xuất ngày đăng từ attribute datetime của thẻ <time>
      const timeEl = $el.find("time").first();
      const dateAttr = timeEl.attr("datetime");

      let baseTime = 0;
      if (dateAttr) {
        baseTime = Date.parse(dateAttr);
      }
      if (!baseTime || isNaN(baseTime)) {
        const textTime = timeEl.text().trim();
        baseTime = textTime ? Date.parse(textTime) : Date.now();
      }
      if (!baseTime || isNaN(baseTime)) {
        baseTime = Date.now();
      }

      // Trích xuất tên tác giả nếu có trong Docusaurus avatar
      const author = $el.find(".avatar__name").text().trim() ||
        "Project Bluefin";

      // Trừ đi index * 60000 để giữ nguyên thứ tự xuất hiện trên trang chủ
      const createdAt = baseTime - (index * 60 * 1000);

      // Tránh trùng lặp bài viết
      if (!posts.some((p) => p.id === id)) {
        posts.push({
          id,
          title,
          url: postUrl,
          source: this.source,
          author,
          createdAt,
          summary: summary || undefined,
        });
      }
    });

    return posts;
  }

  async fetchContent(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: COMMON_HEADERS,
    });

    if (!response.ok) {
      throw new Error(`Không thể tải bài viết: Mã lỗi ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Docusaurus lưu trữ nội dung Markdown bên trong class .markdown
    let contentEl = $(".markdown").first();
    if (!contentEl.length) {
      contentEl = $("article").first();
    }

    if (!contentEl.length) {
      return "Không tìm thấy thẻ chứa nội dung bài viết.";
    }

    // Loại bỏ các thành phần header, footer của trang
    contentEl.find(
      "script, style, iframe, footer, header, .breadcrumbs, .theme-doc-version-badge",
    ).remove();

    return contentEl.html() || "Nội dung bài viết trống.";
  }
}
