import * as cheerio from "cheerio";
import { Post, Scraper } from "../types.ts";
import { getPostId } from "./utils.ts";
import { COMMON_HEADERS } from "./constants.ts";
import { processPostImages } from "./image_downloader.ts";

export class VTCNewsScraper implements Scraper {
  source = "VTCNews" as const;

  async fetchPosts(): Promise<Post[]> {
    const posts: Post[] = [];
    let overallIndex = 0;

    for (let page = 1; page <= 3; page++) {
      const url = `https://vtcnews.vn/tin-moi-hom-nay/trang-${page}.html`;
      try {
        const response = await fetch(url, {
          headers: COMMON_HEADERS,
        });

        if (!response.ok) {
          console.warn(
            `[VTCNews] Failed to fetch page ${page}: Status ${response.status}`,
          );
          continue;
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        const listArticles = $(".list-articles");
        if (listArticles.length === 0) continue;

        const articles = listArticles.find("article.ar1");

        articles.each((_, element) => {
          const $el = $(element);
          const titleLink = $el.find("h3 a").first();
          const href = titleLink.attr("href");
          if (!href) return;

          const title = titleLink.text().trim() || titleLink.attr("title") ||
            "";
          if (!title) return;

          const summary = $el.find("p").first().text().trim();
          const postUrl = href.startsWith("http")
            ? href
            : `https://vtcnews.vn${href}`;

          // Trích xuất ID bài viết dạng vtcnews-xxxxxx
          const id = getPostId(this.source, postUrl);

          // Trích xuất thời gian đăng bài
          const timeEl = $el.find("footer .time-update").first();
          const timeText = timeEl.text().trim();
          let createdAt = Date.now();
          if (timeText) {
            const match = timeText.match(
              /(\d{2}):(\d{2})\s+(\d{2})\/(\d{2})\/(\d{4})/,
            );
            if (match) {
              const [_, hh, mm, DD, MM, YYYY] = match;
              const isoStr = `${YYYY}-${MM}-${DD}T${hh}:${mm}:00+07:00`;
              const parsed = Date.parse(isoStr);
              if (!isNaN(parsed)) {
                createdAt = parsed;
              }
            }
          }

          // Điều chỉnh nhẹ miliseconds để giữ nguyên thứ tự sắp xếp theo danh sách cào về
          createdAt = createdAt - (overallIndex * 1000);
          overallIndex++;

          posts.push({
            id,
            title,
            url: postUrl,
            source: this.source,
            author: "VTC News",
            createdAt,
            summary: summary || undefined,
          });
        });
      } catch (err) {
        console.error(`[VTCNews] Error scraping page ${page}:`, err);
      }
    }

    return posts;
  }

  async fetchContent(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: COMMON_HEADERS,
    });

    if (!response.ok) {
      throw new Error(
        `Không thể tải bài viết VTC News: Mã lỗi ${response.status}`,
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Lấy vùng nội dung chính
    const contentEl = $(".edittor-content").first();
    if (!contentEl.length) {
      return "Không tìm thấy thẻ chứa nội dung bài viết.";
    }

    // Loại bỏ quảng cáo, tin liên quan, script
    contentEl.find(
      "script, style, iframe, .ad-wrapper, .ad-position, .link-content-footer, .cf-monitor, .ads-item, .sponsored-banner, .related-news-list, input",
    ).remove();

    // Đồng bộ thuộc tính src của hình ảnh (vì VTC News dùng lazyload base64)
    contentEl.find("img").each((_, img) => {
      const $img = $(img);
      const dataSrc = $img.attr("data-src") || $img.attr("src");
      if (dataSrc) {
        $img.attr("src", dataSrc);
      }
      $img.removeAttr("srcset");
      $img.removeAttr("class");
      $img.removeAttr("style");
      $img.attr("referrerpolicy", "no-referrer");
      $img.css({
        "max-width": "100%",
        "height": "auto",
        "display": "block",
        "margin": "10px auto",
        "border-radius": "4px",
      });
    });

    // Tạo HTML chứa Sapo (nếu có) và Nội dung chính
    let contentHtml = "";
    const sapo = $(".content-wrapper h2").first().text().trim();
    if (sapo) {
      contentHtml += `<p><strong>${sapo}</strong></p>`;
    }
    contentHtml += contentEl.html() || "";

    const cleanHtml = contentHtml.trim() || "Nội dung bài viết trống.";
    return await processPostImages(cleanHtml, url);
  }
}
