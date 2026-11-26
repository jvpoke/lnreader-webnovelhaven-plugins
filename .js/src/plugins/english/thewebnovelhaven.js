const cheerio = require('cheerio');
const { fetchApi } = require('@libs/fetch');

const SITE = 'https://thewebnovelhaven.wordpress.com';
const CATALOGUE = '/__trashed/';
const CHAPTER_PATH = /^\/\d{4}\/\d{2}\/\d{2}\/chap-[^/]+\/$/i;
const NOVEL_PATH = /^\/[a-z0-9][a-z0-9-]+\/$/i;

class TheWebNovelHaven {
  constructor() {
    this.id = 'thewebnovelhaven';
    this.name = 'The Web Novel Haven';
    this.icon = 'src/en/thewebnovelhaven/icon.png';
    this.site = SITE;
    this.version = '1.0.1';
    this.filters = undefined;
  }

  async popularNovels(page) {
    if (page > 1) return [];
    return this.fetchCatalogue();
  }

  async searchNovels(query, page) {
    if (page > 1) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return (await this.fetchCatalogue()).filter(novel =>
      novel.name.toLowerCase().includes(needle),
    );
  }

  async parseNovel(path) {
    const firstPage = await this.loadNovelPage(path);
    const pages = this.novelPages(path, firstPage);
    const documents = [firstPage];

    for (const page of pages.slice(1)) {
      documents.push(await this.loadNovelPage(page));
    }

    const first = cheerio.load(firstPage);
    const chapters = [];
    const seen = new Set();
    let cover;
    let summary = '';

    for (const html of documents) {
      const $ = cheerio.load(html);
      if (!cover) {
        cover =
          $('meta[property="og:image"]').attr('content') ||
          $('.entry-content img[src]').first().attr('src');
      }
      if (!summary) summary = this.parseSummary($);
      this.collectChapters($, chapters, seen);
    }

    if (!chapters.length) {
      throw new Error(`The Web Novel Haven: no chapters listed at ${path}`);
    }

    const title =
      first('meta[property="og:title"]').attr('content') ||
      first('title').text().replace(/\s+[–-]\s+yourwebnovelhaven$/i, '').trim() ||
      path;

    return {
      path,
      name: this.normalizeText(title),
      cover,
      summary,
      chapters,
    };
  }

  async parseChapter(path) {
    const html = await this.fetchHtml(path);
    const $ = cheerio.load(html);
    const content = $('.entry-content').first();

    if (!content.length) {
      throw new Error(`The Web Novel Haven: no chapter content at ${path}`);
    }

    content
      .find(
        'script, style, noscript, .sharedaddy, .jp-relatedposts, .post-navigation, .comments-area, .sd-title, form',
      )
      .remove();
    content.find('a').each((_, element) => {
      const href = $(element).attr('href') || '';
      if (/previous|next|chapter list|table of contents/i.test($(element).text())) {
        $(element).closest('p').remove();
      } else if (/^https?:\/\//i.test(href)) {
        $(element).attr('target', '_blank');
      }
    });

    const result = content.html();
    if (!result || !content.text().trim()) {
      throw new Error(`The Web Novel Haven: empty chapter at ${path}`);
    }
    return result;
  }

  async fetchCatalogue() {
    const html = await this.fetchHtml(CATALOGUE);
    const $ = cheerio.load(html);
    const novels = [];
    const seen = new Set();

    $('.entry-content a[href]').each((_, element) => {
      const href = this.toPath($(element).attr('href') || '');
      const name = this.normalizeText($(element).text());
      if (
        NOVEL_PATH.test(href) &&
        href !== CATALOGUE &&
        !/^(\/about|\/dropped|\/annou|\/recent|\/category|\/tag)/i.test(href) &&
        name.length > 1 &&
        !seen.has(href)
      ) {
        seen.add(href);
        novels.push({ name, path: href });
      }
    });

    const parsed = [];
    for (const novel of novels) {
      try {
        const item = await this.parseNovel(novel.path);
        parsed.push({ name: item.name, path: item.path, cover: item.cover });
      } catch (_) {
        // The catalogue contains occasional retired or incomplete entries.
      }
    }
    return parsed;
  }

  collectChapters($, chapters, seen) {
    $('.entry-content a[href]').each((_, element) => {
      const path = this.toPath($(element).attr('href') || '');
      if (!CHAPTER_PATH.test(path) || seen.has(path)) return;
      seen.add(path);
      const match = path.match(/\/([0-9]{4})\/([0-9]{2})\/([0-9]{2})\//);
      const name = this.normalizeText($(element).text()) || path;
      chapters.push({
        name,
        path,
        chapterNumber: this.chapterNumber(name, path),
        releaseTime: match ? `${match[1]}-${match[2]}-${match[3]}` : undefined,
      });
    });
  }

  novelPages(path, html) {
    const $ = cheerio.load(html);
    const pages = [path];
    const seen = new Set(pages);
    $('.entry-content .post-nav-links a[href], .entry-content a[href]').each(
      (_, element) => {
        const candidate = this.toPath($(element).attr('href') || '');
        if (
          candidate.startsWith(path.replace(/\/$/, '') + '/') &&
          /^\/[^/]+\/\d+\/$/.test(candidate) &&
          !seen.has(candidate)
        ) {
          seen.add(candidate);
          pages.push(candidate);
        }
      },
    );
    return pages.sort((a, b) => {
      const page = value => Number(value.match(/\/(\d+)\/$/)?.[1] || 1);
      return page(a) - page(b);
    });
  }

  parseSummary($) {
    const paragraphs = [];
    let inSynopsis = false;
    $('.entry-content h2, .entry-content p').each((_, element) => {
      const text = this.normalizeText($(element).text());
      if (element.name === 'h2') {
        inSynopsis = /^synopsis$/i.test(text);
        return;
      }
      if (inSynopsis && text && !/^chapter\s+\d+/i.test(text)) {
        paragraphs.push(text);
      }
    });
    return paragraphs.join('\n\n');
  }

  chapterNumber(name, path) {
    const match = `${name} ${path}`.match(/(?:chapter|chap[-. ]?)(\d+)/i);
    return match ? Number(match[1]) : undefined;
  }

  async loadNovelPage(path) {
    return this.fetchHtml(path);
  }

  async fetchHtml(path) {
    const url = /^https?:\/\//i.test(path) ? path : `${this.site}${path}`;
    const response = await fetchApi(url);
    if (!response.ok) {
      throw Object.assign(
        new Error(`HTTP ${response.status} while fetching ${url}`),
        { status: response.status },
      );
    }
    return response.text();
  }

  toPath(value) {
    const raw = value.trim().split(/[?#]/)[0];
    if (!raw) return '/';
    if (/^https?:\/\//i.test(raw)) {
      try {
        const url = new URL(raw);
        if (url.hostname !== new URL(this.site).hostname) return raw;
        return url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
      } catch (_) {
        return raw;
      }
    }
    const path = raw.startsWith('/') ? raw : `/${raw}`;
    return path.endsWith('/') ? path : `${path}/`;
  }

  normalizeText(value) {
    return value.replace(/\s+/g, ' ').trim();
  }
}

exports.default = new TheWebNovelHaven();
