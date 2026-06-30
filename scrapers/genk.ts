import * as cheerio from "cheerio";
import { Post, Scraper } from "../types.ts";
import { COMMON_HEADERS } from "./constants.ts";

export class GenKScraper implements Scraper {
  source = "GenK" as const;

  async fetchPosts(): Promise<Post[]> {
    const posts: Post[] = [];
    let overallIndex = 0;

    for (let page = 1; page <= 3; page++) {
      const url = `https://genk.vn/ajax-list-cate/type-0/page-${page}.chn`;
      try {
        const response = await fetch(url, {
          headers: COMMON_HEADERS
        });

        if (!response.ok) {
          console.warn(`[GenK] Failed to fetch page ${page}: Status ${response.status}`);
          continue;
        }

        const html = await response.text();
        // Wrap in ul tags because the AJAX endpoint returns raw <li> elements
        const $ = cheerio.load(`<ul>${html}</ul>`);

        $("li").each((_, element) => {
          const $el = $(element);
          const titleLink = $el.find(".knswli-title a, .gkswli-title a, h3 a, a[href]").first();
          const href = titleLink.attr("href");

          if (!href) return;

          const title = titleLink.text().trim() || titleLink.attr("title") || "";
          if (!title) return;

          const summary = $el.find(".knswli-right, p, .knswli-sapo, .gkswli-sapo, .sapo").first().text().trim();
          
          // Chuyển relative URL sang absolute URL
          const postUrl = href.startsWith("http") ? href : `https://genk.vn${href}`;

          // Trích xuất ID duy nhất từ slug URL
          const idMatch = postUrl.match(/-(\d+)\.chn$/);
          const id = idMatch ? `genk-${idMatch[1]}` : `genk-${encodeURIComponent(postUrl).slice(-20)}`;

          // Trích xuất ngày đăng từ attribute title của thẻ thời gian
          const timeEl = $el.find(".knswli-time, .time, .date-time").first();
          const dateAttr = timeEl.attr("title");
          
          let baseTime = 0;
          if (dateAttr) {
            baseTime = Date.parse(dateAttr);
          }
          if (!baseTime || isNaN(baseTime)) {
            const textTime = timeEl.text().replace(/[|]/g, "").trim();
            baseTime = textTime ? Date.parse(textTime) : Date.now();
          }
          if (!baseTime || isNaN(baseTime)) {
            baseTime = Date.now();
          }

          // Trừ đi index * 60000 để giữ nguyên thứ tự xuất hiện
          const createdAt = baseTime - (overallIndex * 60 * 1000);
          overallIndex++;

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
      } catch (err) {
        console.error(`[GenK] Error scraping page ${page}:`, err);
      }
    }

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
