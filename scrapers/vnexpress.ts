import * as cheerio from "cheerio";
import { Post, Scraper } from "../types.ts";
import { getPostId } from "./utils.ts";

import { COMMON_HEADERS } from "./constants.ts";

export class VnExpressScraper implements Scraper {
  source = "VnExpress" as const;

  async fetchPosts(): Promise<Post[]> {
    const posts: Post[] = [];
    let overallIndex = 0;
    let lastKnownTime = Date.now();

    for (let page = 1; page <= 3; page++) {
      const url = `https://vnexpress.net/tin-tuc-24h-p${page}`;
      try {
        const response = await fetch(url, {
          headers: COMMON_HEADERS,
        });

        if (!response.ok) {
          console.warn(
            `[VnExpress] Failed to fetch page ${page}: Status ${response.status}`,
          );
          continue;
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        const container = $("div.width_common.list-news-subfolder");
        const articles = container.find(
          "article.item-news.item-news-common.thumb-left",
        );

        articles.each((_, element) => {
          const $el = $(element);
          const titleLink = $el.find("h3.title-news a").first();
          const href = titleLink.attr("href");

          if (!href) return;

          const title = titleLink.text().trim() || titleLink.attr("title") ||
            "";
          if (!title) return;

          const summary = $el.find("p.description").text().trim();

          const postUrl = href.startsWith("http")
            ? href
            : `https://vnexpress.net${href}`;

          // Extract ID from URL
          const id = getPostId(this.source, postUrl);

          // Extract created time
          const timeEl = $el.find(".time-ago").first();
          const datetimeAttr = timeEl.attr("datetime");

          let baseTime = lastKnownTime;
          if (datetimeAttr) {
            const isoStr = datetimeAttr.replace(" ", "T") + "+07:00";
            const parsedTime = Date.parse(isoStr);
            if (!isNaN(parsedTime)) {
              baseTime = parsedTime;
              lastKnownTime = parsedTime;
            }
          } else {
            // Decrement slightly for items with missing timestamps to maintain order
            baseTime = lastKnownTime - 5 * 60 * 1000;
            lastKnownTime = baseTime;
          }

          // Index-based minor adjustment to avoid identical timestamps and preserve exact list ordering
          const createdAt = baseTime - (overallIndex * 1000);
          overallIndex++;

          posts.push({
            id,
            title,
            url: postUrl,
            source: this.source,
            author: "VnExpress",
            createdAt,
            summary: summary || undefined,
          });
        });
      } catch (err) {
        console.error(`[VnExpress] Error scraping page ${page}:`, err);
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
        `Không thể tải bài viết VnExpress: Mã lỗi ${response.status}`,
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Check if it is a Podcast / Evisual / Audio page
    const titleText = $("title").text() || $("meta[property='og:title']").attr("content") || "";
    const itsType = $("meta[name='its_type']").attr("content") || "";
    if (
      itsType === "evisual" ||
      titleText.toLowerCase().includes("nghe podcast") ||
      titleText.toLowerCase().includes("nghe audio") ||
      $("#wrapper-evisual").length > 0 ||
      $(".section-detail-podcast").length > 0
    ) {
      throw new Error("Bài viết thuộc thể loại Podcast/Audio và không được hỗ trợ.");
    }

    // VnExpress content is in .fck_detail (e.g. section.fck_detail or article.fck_detail)
    const contentEl = $(".fck_detail");

    if (!contentEl.length) {
      return "Không tìm thấy thẻ chứa nội dung bài viết.";
    }

    // Check if it is a quiz/multiple-choice interactive post
    if (contentEl.find("[data-component-type='quiz']").length > 0) {
      throw new Error("Bài viết thuộc thể loại trắc nghiệm (quiz) và không được hỗ trợ.");
    }

    // Clean up unnecessary elements
    contentEl.find(
      "script, style, iframe, .ad-wrapper, .ad-position, .link-content-footer, .cf-monitor, .social-com, .social_pin, .neo-pin, .topbar-sticky, .action_thumb, .item_slide_show.hidden, .info-detail-tg, .follow_author",
    ).remove();

    // Remove the title/description elements if nested inside .fck_detail to prevent double rendering in UI
    contentEl.find(
      ".title-detail, .description, .box-tinlienquan, .banner-ads, .insert-link-news",
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

    // Remove source and replace picture/wrapper tags to avoid responsive/positioning issues
    contentEl.find("picture source").remove();
    contentEl.find("picture").each((_, pic) => {
      const $pic = $(pic);
      const img = $pic.find("img");
      if (img.length) {
        $pic.replaceWith(img);
      }
    });

    contentEl.find(".fig-picture").each((_, div) => {
      const $div = $(div);
      const img = $div.find("img");
      if (img.length) {
        $div.replaceWith(img);
      }
    });

    // Process visible item_slide_show elements to extract images and captions cleanly
    contentEl.find(".item_slide_show").each((_, el) => {
      const $el = $(el);
      const img = $el.find("img");
      if (!img.length) {
        $el.remove();
        return;
      }
      
      const captionEl = $el.find(".desc_cation").not("[style*='display: none']").not("[style*='height: 0']");
      const captionHtml = captionEl.html() || "";
      
      const figure = $("<figure class=\"cozy-picture\"></figure>");
      // Clone the already cleaned image
      figure.append(img.first().clone());
      
      if (captionHtml.trim()) {
        figure.append($(`<figcaption class="cozy-caption">${captionHtml}</figcaption>`));
      }
      
      $el.replaceWith(figure);
    });

    // Process gallery-detail-photo elements to extract images and captions cleanly
    contentEl.find(".gallery-detail-photo").each((_, el) => {
      const $el = $(el);
      const figures: cheerio.Cheerio<any>[] = [];
      
      $el.find(".item_gallery_new img").each((_, imgEl) => {
        const $img = $(imgEl);
        const rawCaption = $img.attr("data-caption") || "";
        
        const figure = $("<figure class=\"cozy-picture\"></figure>");
        // Clone the already cleaned image and strip data-caption (since it's now in figcaption)
        const clonedImg = $img.clone().removeAttr("data-caption");
        figure.append(clonedImg);
        
        if (rawCaption.trim()) {
          figure.append($(`<figcaption class="cozy-caption">${rawCaption}</figcaption>`));
        }
        
        figures.push(figure);
      });
      
      if (figures.length > 0) {
        const container = $("<div class=\"cozy-gallery-container\"></div>");
        figures.forEach(fig => container.append(fig));
        $el.replaceWith(container);
      } else {
        $el.remove();
      }
    });

    let contentHtml = "";
    contentEl.each((_, el) => {
      contentHtml += $(el).html() || "";
    });

    return contentHtml.trim() || "Nội dung bài viết trống.";
  }
}
