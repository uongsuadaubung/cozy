import * as cheerio from "cheerio";
import { Post, Scraper } from "../types.ts";
import { COMMON_HEADERS } from "./constants.ts";

export class DantriScraper implements Scraper {
  source = "Dantri" as const;

  async fetchPosts(): Promise<Post[]> {
    const posts: Post[] = [];
    const mainUrl = "https://dantri.com.vn/tin-moi-nhat.htm";
    let overallIndex = 0;

    try {
      // 1. Tải trang chính để lấy danh sách tin đầu tiên
      const response = await fetch(mainUrl, {
        headers: COMMON_HEADERS,
      });

      if (!response.ok) {
        console.warn(`[Dantri] Failed to fetch main page: Status ${response.status}`);
        return [];
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Parse danh sách tin từ trang chính
      $(".article-newest article.article-item").each((_, element) => {
        const $el = $(element);
        const titleLink = $el.find(".article-title a, h3 a, h2 a").first();
        const href = titleLink.attr("href");

        if (!href) return;

        // Skip non-standard articles (videos, live coverage, photo essays)
        const label = titleLink.attr("data-label");
        if (label && ["Video", "Trực tiếp", "Ảnh", "Infographic"].includes(label)) {
          return;
        }

        const title = titleLink.text().trim() || titleLink.attr("title") || "";
        if (!title) return;

        const summary = $el.find(".article-excerpt").text().trim();
        const postUrl = href.startsWith("http")
          ? href
          : `https://dantri.com.vn${href}`;

        // Trích xuất ID bài viết từ URL hoặc attribute data-id
        const dataId = $el.attr("data-id");
        const idMatch = postUrl.match(/-(\d+)\.htm$/);
        const id = dataId
          ? `dantri-${dataId}`
          : (idMatch ? `dantri-${idMatch[1]}` : `dantri-${encodeURIComponent(postUrl).slice(-20)}`);

        // Phân tích ngày giờ từ data-id (định dạng YYYYMMDDHHmmssSSS)
        let createdAt = Date.now();
        const timePart = dataId || (idMatch ? idMatch[1] : "");
        if (timePart && timePart.length >= 14) {
          const year = parseInt(timePart.substring(0, 4), 10);
          const month = parseInt(timePart.substring(4, 6), 10) - 1;
          const day = parseInt(timePart.substring(6, 8), 10);
          const hour = parseInt(timePart.substring(8, 10), 10);
          const min = parseInt(timePart.substring(10, 12), 10);
          const sec = parseInt(timePart.substring(12, 14), 10);

          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}+07:00`;
          const parsed = Date.parse(dateStr);
          if (!isNaN(parsed)) {
            createdAt = parsed;
          }
        }

        // Tinh chỉnh nhẹ timestamp để tránh trùng lặp tuyệt đối
        createdAt = createdAt - (overallIndex * 1000);
        overallIndex++;

        posts.push({
          id,
          title,
          url: postUrl,
          source: this.source,
          author: "Dân trí",
          createdAt,
          summary: summary || undefined,
        });
      });

      // 2. Lấy tham số phân trang để tải tiếp trang 2 và trang 3 từ API
      const loadMoreEl = $('div[data-module="newest-load-more"]');
      let lastDate = loadMoreEl.attr("data-last-date-article");
      const offsetStr = loadMoreEl.attr("data-offset");

      if (lastDate && offsetStr) {
        let offset = parseInt(offsetStr, 10);

        for (let page = 2; page <= 3; page++) {
          const apiUrl = `https://dantri.com.vn/api/newest/get-more-newest-article/${lastDate}/${offset}/${offset}.htm`;
          try {
            const apiResponse = await fetch(apiUrl, {
              headers: COMMON_HEADERS,
            });

            if (!apiResponse.ok) {
              console.warn(`[Dantri] Failed to fetch page ${page} from API: Status ${apiResponse.status}`);
              break;
            }

            const json = await apiResponse.json();
            const apiHtml = json.data;

            // Cập nhật tham số cho trang kế tiếp
            lastDate = json.lastDateArticle;
            offset = json.offset;

            if (!apiHtml) break;

            const $api = cheerio.load(`<div>${apiHtml}</div>`);
            $api("article.article-item").each((_, element) => {
              const $el = $api(element);
              const titleLink = $el.find(".article-title a, h3 a, h2 a").first();
              const href = titleLink.attr("href");

              if (!href) return;

              // Skip non-standard articles (videos, live coverage, photo essays)
              const label = titleLink.attr("data-label");
              if (label && ["Video", "Trực tiếp", "Ảnh", "Infographic"].includes(label)) {
                return;
              }

              const title = titleLink.text().trim() || titleLink.attr("title") || "";
              if (!title) return;

              const summary = $el.find(".article-excerpt").text().trim();
              const postUrl = href.startsWith("http")
                ? href
                : `https://dantri.com.vn${href}`;

              const dataId = $el.attr("data-id");
              const idMatch = postUrl.match(/-(\d+)\.htm$/);
              const id = dataId
                ? `dantri-${dataId}`
                : (idMatch ? `dantri-${idMatch[1]}` : `dantri-${encodeURIComponent(postUrl).slice(-20)}`);

              let createdAt = Date.now();
              const timePart = dataId || (idMatch ? idMatch[1] : "");
              if (timePart && timePart.length >= 14) {
                const year = parseInt(timePart.substring(0, 4), 10);
                const month = parseInt(timePart.substring(4, 6), 10) - 1;
                const day = parseInt(timePart.substring(6, 8), 10);
                const hour = parseInt(timePart.substring(8, 10), 10);
                const min = parseInt(timePart.substring(10, 12), 10);
                const sec = parseInt(timePart.substring(12, 14), 10);

                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}+07:00`;
                const parsed = Date.parse(dateStr);
                if (!isNaN(parsed)) {
                  createdAt = parsed;
                }
              }

              createdAt = createdAt - (overallIndex * 1000);
              overallIndex++;

              posts.push({
                id,
                title,
                url: postUrl,
                source: this.source,
                author: "Dân trí",
                createdAt,
                summary: summary || undefined,
              });
            });
          } catch (err) {
            console.error(`[Dantri] Error scraping page ${page} from API:`, err);
            break;
          }
        }
      }
    } catch (err) {
      console.error(`[Dantri] General error scraping:`, err);
    }

    return posts;
  }

  async fetchContent(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: COMMON_HEADERS,
    });

    if (!response.ok) {
      throw new Error(`Không thể tải bài viết Dân trí: Mã lỗi ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // DanTri content is inside #desktop-in-article
    let contentEl = $("#desktop-in-article");
    if (!contentEl.length) {
      contentEl = $(".singular-content, .detail-content, .article-content").first();
    }

    if (!contentEl.length) {
      return "Không tìm thấy thẻ chứa nội dung bài viết.";
    }

    // Clean up unnecessary elements
    contentEl.find(
      "script, style, iframe, .ad-wrapper, .ad-position, .link-content-footer, .cf-monitor",
    ).remove();

    // Rewrite images for lazy loading, responsiveness and hotlink protection
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

    return contentEl.html() || "Nội dung bài viết trống.";
  }
}
