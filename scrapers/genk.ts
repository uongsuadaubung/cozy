import * as cheerio from "cheerio";
import { Post, Scraper } from "../types.ts";
import { COMMON_HEADERS } from "./constants.ts";

export class GenKScraper implements Scraper {
  source = "GenK" as const;

  async fetchPosts(): Promise<Post[]> {
    const url = "https://genk.vn/";
    const response = await fetch(url, {
      headers: COMMON_HEADERS
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch GenK.vn: Status ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const posts: Post[] = [];

    // Chọn danh sách bài viết từ main stream (.knswli)
    $(".knswli").each((index, element) => {
      const $el = $(element);
      const titleLink = $el.find(".knswli-title a, .gkswli-title a, h3 a").first();
      const href = titleLink.attr("href");

      if (!href) return;

      const title = titleLink.text().trim();
      const summary = $el.find(".knswli-sapo, .gkswli-sapo, .sapo").text().trim();
      
      // Chuyển relative URL sang absolute URL
      const postUrl = href.startsWith("http") ? href : `https://genk.vn${href}`;

      // Trích xuất ID duy nhất từ slug URL (ví dụ: ...-165260629121258118.chn -> genk-165260629121258118)
      const idMatch = postUrl.match(/-(\d+)\.chn$/);
      const id = idMatch ? `genk-${idMatch[1]}` : `genk-${encodeURIComponent(postUrl).slice(-20)}`;

      // Trích xuất ngày đăng từ attribute title của thẻ thời gian (chứa chuỗi ISO datetime: 2026-06-29T15:10:00)
      const timeEl = $el.find(".knswli-time, .time").first();
      const dateAttr = timeEl.attr("title");
      
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

      posts.push({
        id,
        title,
        url: postUrl,
        source: this.source,
        author: "GenK",
        createdAt,
        summary: summary || undefined
      });
    });

    return posts;
  }

  async fetchContent(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: COMMON_HEADERS
    });

    if (!response.ok) {
      throw new Error(`Không thể tải bài viết: Mã lỗi ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Nội dung chính nằm trong .knc-content
    const contentEl = $(".knc-content, #mainContent, .detail-content").first();

    if (!contentEl.length) {
      return "Không tìm thấy thẻ chứa nội dung bài viết.";
    }

    // Loại bỏ các thành phần quảng cáo, liên kết liên quan và script
    contentEl.find("script, style, iframe, .ad-wrapper, .ad-position, .link-content-footer, .knc-relate-link, .cf-monitor").remove();

    return contentEl.html() || "Nội dung bài viết trống.";
  }
}
