import * as cheerio from "cheerio";
import { Post, Scraper } from "../types.ts";
import { COMMON_HEADERS } from "./constants.ts";

export class OmgLinuxScraper implements Scraper {
  source = "OmgLinux" as const;

  async fetchPosts(): Promise<Post[]> {
    const url = "https://www.omglinux.com/";
    const response = await fetch(url, { headers: COMMON_HEADERS });

    if (!response.ok) {
      throw new Error(`Failed to fetch OMG! Linux!: Status ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const posts: Post[] = [];

    // Phân tích danh sách bài viết từ các thẻ <article>
    $("article").each((index, element) => {
      const $el = $(element);
      const titleLink = $el.find(".entry-title a, h3.entry-title a, h2.entry-title a").first();
      const href = titleLink.attr("href");
      const title = titleLink.text().trim();

      if (!href || !title) return;

      // Tránh trùng lặp bài viết
      if (posts.some(p => p.url === href)) return;

      // Mặc định tên tác giả là "OMG! Linux!" vì trang chủ không hiển thị tên tác giả
      const author = "OMG! Linux!";
      
      // Trích xuất ngày đăng từ thẻ <time>
      const timeEl = $el.find("time").first();
      const dateText = timeEl.attr("datetime") || timeEl.text().trim();
      const createdAt = dateText ? Date.parse(dateText) : Date.now();

      // Trích xuất ID duy nhất từ slug URL (ví dụ: .../kde-linux-immutable-os/ -> omgl-kde-linux-immutable-os)
      let slug = "";
      try {
        const pathParts = new URL(href).pathname.split("/").filter(Boolean);
        slug = pathParts[pathParts.length - 1];
      } catch {
        slug = title;
      }
      const id = `omgl-${slug}`;

      // Giữ nguyên thứ tự xuất hiện bằng cách trừ đi index * 60000ms
      const finalCreatedAt = createdAt - (index * 60 * 1000);

      posts.push({
        id,
        title,
        url: href,
        source: this.source,
        author,
        createdAt: finalCreatedAt
      });
    });

    return posts;
  }

  async fetchContent(url: string): Promise<string> {
    const response = await fetch(url, { headers: COMMON_HEADERS });

    if (!response.ok) {
      throw new Error(`Failed to fetch OMG! Linux! article: Status ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const contentEl = $(".entry-content").first();

    if (!contentEl.length) {
      throw new Error("Could not find article body (.entry-content)");
    }

    // Loại bỏ các thành phần rác như quảng cáo, script, share links
    contentEl.find("script, style, iframe, .ad-wrapper, .adsbygoogle, .pop-under, .social-share-buttons").remove();
    
    // Loại bỏ khung đăng ký email quảng cáo Jetpack và các form đăng ký email
    contentEl.find(".wp-block-jetpack-subscriptions, .wp-block-jetpack-subscriptions__container, .jetpack-subscribe-feed, form.subscribe-form").remove();
    
    // Tìm các form chứa email input và xóa sạch form/div bao quanh
    contentEl.find("input[type='email'], input[name='email']").closest("form, div, section").remove();
    
    // Xóa các dòng text liên quan đến Subscribe
    contentEl.find("h3:contains('Discover more from'), h2:contains('Discover more from'), h4:contains('Discover more from'), p:contains('Discover more from')").remove();
    contentEl.find("p:contains('Subscribe to get'), p:contains('sent to your email'), p:contains('Type your email')").remove();

    const cleanHtml = contentEl.html() || "";
    return cleanHtml;
  }
}
