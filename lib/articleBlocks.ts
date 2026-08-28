// ----------------------------------------------------------------------
// Tiptap HTML → the website's typed block array.
//
// The admin editor stores HTML; the public site renders a blocks[] array
// through components/news/BlockRenderer.vue. This converts between them so
// articles written in the admin render with the site's own styling.
//
// Two deliberate limits:
//  - Block text is emitted as plain text, because the site's block
//    components interpolate with {{ }} rather than v-html. Inline bold,
//    italics and links inside a paragraph are flattened to their text.
//  - Editorial block types the site supports but Tiptap cannot produce
//    (gallery, partners, spacer, attributed quote) are never emitted.
//    Nothing is lost: the editor has no way to author them.
// ----------------------------------------------------------------------

export type ArticleBlock =
  | { type: "paragraph"; content: string }
  | { type: "heading"; content: string; attrs: { level: string; decoration: string } }
  | { type: "image"; src: string; size: string }
  | { type: "list"; name: string; content: string[]; attrs: { bullets: boolean } }
  | { type: "quote"; preface: string; content: string; by: string; image: string; designation: string };

/** h1..h6 → the word-based levels Heading.vue switches on. */
const LEVEL_WORDS = ["one", "two", "three", "four", "five", "six"];

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  ndash: "–", mdash: "—", hellip: "…",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code =
        body[1] === "x" || body[1] === "X"
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/** Inner HTML → plain text, matching how the site interpolates it. */
function toText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

function attr(tag: string, name: string): string {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return m ? decodeEntities(m[1]) : "";
}

// Top-level Tiptap output is a flat run of block elements, so one pass over
// the block-level tags is enough.
const BLOCK_RE =
  /<(p|h[1-6]|ul|ol|blockquote|figure)\b[^>]*>([\s\S]*?)<\/\1>|<img\b[^>]*>/gi;

const LIST_ITEM_RE = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;

export function htmlToBlocks(html: string | null | undefined): ArticleBlock[] {
  if (!html) return [];
  const blocks: ArticleBlock[] = [];

  for (const match of Array.from(html.matchAll(BLOCK_RE))) {
    const [whole, tag, inner] = match;

    // Bare <img>, or a <figure> wrapping one.
    if (!tag || tag.toLowerCase() === "figure") {
      const imgTag = tag ? (inner.match(/<img\b[^>]*>/i)?.[0] ?? "") : whole;
      const src = attr(imgTag, "src");
      if (src) blocks.push({ type: "image", src, size: "contain" });
      continue;
    }

    const name = tag.toLowerCase();

    if (name === "p") {
      const content = toText(inner);
      // Tiptap emits empty paragraphs for blank lines; they'd render as gaps.
      if (content) blocks.push({ type: "paragraph", content });
      continue;
    }

    if (/^h[1-6]$/.test(name)) {
      const content = toText(inner);
      if (!content) continue;
      blocks.push({
        type: "heading",
        content,
        attrs: {
          level: LEVEL_WORDS[Number(name[1]) - 1] ?? "six",
          decoration: "bold",
        },
      });
      continue;
    }

    if (name === "ul" || name === "ol") {
      const items = Array.from(inner.matchAll(LIST_ITEM_RE))
        .map((li: RegExpMatchArray) => toText(li[1]))
        .filter(Boolean);
      if (items.length) {
        blocks.push({
          type: "list",
          name: "",
          content: items,
          attrs: { bullets: name === "ul" },
        });
      }
      continue;
    }

    if (name === "blockquote") {
      const content = toText(inner);
      // The site's quote block carries attribution fields the editor has no
      // way to fill, so they're sent empty rather than guessed at.
      if (content) {
        blocks.push({
          type: "quote",
          preface: "",
          content,
          by: "",
          image: "",
          designation: "",
        });
      }
    }
  }

  return blocks;
}
