import * as cheerio from "cheerio";
import { Post, Scraper } from "../types.ts";
import { COMMON_HEADERS } from "./constants.ts";

export class System76Scraper implements Scraper {
  source = "System76" as const;

  async fetchPosts(): Promise<Post[]> {
    const url = "https://system76.com/blog/";
    const response = await fetch(url, {
      headers: COMMON_HEADERS,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch System76 blog: Status ${response.status}`,
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const posts: Post[] = [];

    // Chọn danh sách bài viết dựa trên các tiêu đề chứa link bài viết
    $("h1 a[href^='/blog/post/'], h2 a[href^='/blog/post/'], h3 a[href^='/blog/post/']")
      .each((index, element) => {
        const $el = $(element);
        const href = $el.attr("href");

        if (!href) return;

        const title = $el.text().trim();
        if (!title) return;

        // Tìm container bao quanh thẻ card bài viết để lấy ngày và mô tả ngắn
        const container = $el.closest(".group");
        if (!container.length) return;

        const summary = container.find("p").text().trim();

        // Chuyển relative URL sang absolute URL
        const postUrl = href.startsWith("http")
          ? href
          : `https://system76.com${href}`;

        // Trích xuất ID duy nhất từ slug URL (ví dụ: /blog/post/cosmic-new-system-monitor -> system76-cosmic-new-system-monitor)
        const idMatch = postUrl.match(/\/blog\/post\/([^\/]+)\/?$/);
        const id = idMatch
          ? `system76-${idMatch[1]}`
          : `system76-${encodeURIComponent(postUrl).slice(-20)}`;

        // Trích xuất ngày đăng từ attribute datetime của thẻ <time>
        const timeEl = container.find("time").first();
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

        // Trừ đi index * 60000 để giữ nguyên thứ tự xuất hiện trên trang chủ
        const createdAt = baseTime - (index * 60 * 1000);

        // Tránh trùng lặp bài viết
        if (!posts.some((p) => p.id === id)) {
          posts.push({
            id,
            title,
            url: postUrl,
            source: this.source,
            author: "System76",
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

    // Dùng thẻ article để lấy toàn bộ nội dung (bao gồm cả các phần prose rời rạc xen kẽ hình ảnh)
    let contentEl = $("article").first();
    if (!contentEl.length) {
      contentEl = $(".prose").first();
    }

    if (!contentEl.length) {
      return "Không tìm thấy thẻ chứa nội dung bài viết.";
    }

    // Loại bỏ header bài viết, script, style, comments
    contentEl.find(
      "script, style, iframe, header, footer, .ad-wrapper, .ad-position",
    ).remove();

    return contentEl.html() || "Nội dung bài viết trống.";
  }
}
