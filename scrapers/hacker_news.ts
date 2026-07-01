import * as cheerio from "cheerio";
import { Post, Scraper } from "../types.ts";
import { COMMON_HEADERS } from "./constants.ts";

export class HackerNewsScraper implements Scraper {
  source = "HackerNews" as const;

  async fetchPosts(): Promise<Post[]> {
    const url = "https://thehackernews.com/";
    const response = await fetch(url, {
      headers: COMMON_HEADERS,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Hacker News: Status ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const posts: Post[] = [];

    $(".body-post").each((index, element) => {
      const $el = $(element);
      const storyLink = $el.find("a.story-link");
      const postUrl = storyLink.attr("href");

      if (!postUrl) return;

      // Chỉ lấy các bài viết thuộc tên miền chính thức thehackernews.com
      // (Bỏ qua các link quảng cáo, webinar bên ngoài có đuôi tên miền khác như .uk, sans.org...)
      if (!postUrl.startsWith("https://thehackernews.com/")) return;

      const title = $el.find(".home-title").text().trim() ||
        storyLink.find(".home-title").text().trim() ||
        $el.find("h2").text().trim();

      const summary = $el.find(".home-desc").text().trim();

      // Trích xuất ID duy nhất từ slug URL (ví dụ: .../some-slug.html -> thn-some-slug)
      const idMatch = postUrl.match(/\/([^\/]+)\.html$/);
      const id = idMatch
        ? `thn-${idMatch[1]}`
        : `thn-${encodeURIComponent(postUrl).slice(-20)}`;

      // Trích xuất ngày đăng từ label: ví dụ "Jun 29, 2026"
      const labelText = $el.find(".item-label").text().trim();
      const dateMatch = labelText.match(
        /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}, \d{4}/i,
      );

      let baseTime = 0;
      if (dateMatch) {
        baseTime = Date.parse(dateMatch[0]);
      }
      if (!baseTime || isNaN(baseTime)) {
        baseTime = Date.now();
      }

      // Trừ đi index * 60000 để giữ nguyên thứ tự xuất hiện trên trang chủ
      const createdAt = baseTime - (index * 60 * 1000);

      posts.push({
        id,
        title,
        url: postUrl,
        source: this.source,
        author: "The Hacker News",
        createdAt,
        summary: summary || undefined,
      });
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

    // Nội dung chính thường nằm trong .post-body
    const contentEl = $(".post-body, .articlebody, #articlebody").first();

    if (!contentEl.length) {
      return "Không tìm thấy thẻ chứa nội dung bài viết.";
    }

    // Loại bỏ các thành phần meta, link, script, style, ads, chia sẻ và boilerplate rác để nội dung hiển thị sạch sẽ nhất
    contentEl.find([
      "script",
      "style",
      "iframe",
      "meta",
      "link",
      ".ad-wrapper",
      ".cf-monitor",
      ".pop-under",
      ".adsbygoogle",
      ".post-head",
      ".schema_org",
      ".float-share",
      ".sharebelow",
      ".mobile-share",
      ".tags",
      ".note-b",
    ].join(", ")).remove();

    return contentEl.html() || "Nội dung bài viết trống.";
  }
}
