"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Color from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { useCallback, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

// ─── Toolbar button ───────────────────────────────────────────────────────────

function Btn({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={[
        "h-7 min-w-[1.75rem] px-1.5 flex items-center justify-center rounded text-sm transition-colors",
        active
          ? "bg-navy-900 text-white"
          : "text-slate-700 hover:bg-slate-200",
        disabled ? "opacity-30 pointer-events-none" : "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-slate-200 mx-0.5 self-center shrink-0" />;
}

// ─── Colour swatches ──────────────────────────────────────────────────────────

const TEXT_COLORS = [
  "#000000", "#374151", "#6b7280", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899",
  "#ffffff",
];
const HIGHLIGHT_COLORS = [
  "#fef08a", "#bbf7d0", "#bfdbfe", "#fecaca", "#e9d5ff",
  "#fed7aa", "#fbcfe8", "#f1f5f9",
];

function ColorPicker({
  colors,
  onSelect,
  label,
}: {
  colors: string[];
  onSelect: (c: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        title={label}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="h-7 px-1.5 flex items-center gap-0.5 rounded text-sm text-slate-700 hover:bg-slate-200 transition-colors"
      >
        <span className="text-xs font-bold">{label === "Text colour" ? "A" : "H"}</span>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 6" fill="currentColor" className="w-2 h-2">
          <path d="M0 0l5 6 5-6H0Z" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-lg p-2 flex flex-wrap gap-1 w-40">
          {colors.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              style={{ background: c }}
              onMouseDown={() => { onSelect(c); setOpen(false); }}
              className="w-6 h-6 rounded border border-slate-300 hover:scale-110 transition-transform"
            />
          ))}
          <button
            type="button"
            onMouseDown={() => { onSelect(""); setOpen(false); }}
            className="w-full text-xs text-slate-500 hover:text-slate-700 mt-1 text-left"
          >
            ✕ Clear
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Image insert ─────────────────────────────────────────────────────────────

function ImageInsert({ onInsert }: { onInsert: (url: string) => void }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  return (
    <div className="relative">
      <Btn onClick={() => setOpen((o) => !o)} title="Insert image" active={open}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M2 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4Zm10 5.414-1.293-1.293a1 1 0 0 0-1.414 0L7 10.414l-1.293-1.293a1 1 0 0 0-1.414 0L3 10.414V12h9v-2.586ZM6.5 7a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" clipRule="evenodd" />
        </svg>
      </Btn>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-lg p-3 w-72">
          <p className="text-xs font-medium text-slate-600 mb-1.5">Image URL</p>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500 mb-2"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button"
              onMouseDown={() => { if (url.trim()) { onInsert(url.trim()); setUrl(""); setOpen(false); } }}
              className="flex-1 py-1 rounded bg-navy-900 text-white text-xs font-medium hover:bg-navy-700"
            >
              Insert
            </button>
            <button type="button" onMouseDown={() => setOpen(false)} className="px-3 py-1 rounded border text-xs text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Link insert ──────────────────────────────────────────────────────────────

function LinkInsert({ onInsert, onRemove }: { onInsert: (url: string) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  return (
    <div className="relative">
      <Btn onClick={() => setOpen((o) => !o)} title="Insert link" active={open}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
          <path d="M6.22 8.72a.75.75 0 0 0 1.06 1.06l5.22-5.22v1.69a.75.75 0 0 0 1.5 0v-3.5a.75.75 0 0 0-.75-.75h-3.5a.75.75 0 0 0 0 1.5h1.69L6.22 8.72Z" />
          <path d="M3.5 6.75c0-.69.56-1.25 1.25-1.25H7A.75.75 0 0 0 7 4H4.75A2.75 2.75 0 0 0 2 6.75v4.5A2.75 2.75 0 0 0 4.75 14h4.5A2.75 2.75 0 0 0 12 11.25V9a.75.75 0 0 0-1.5 0v2.25c0 .69-.56 1.25-1.25 1.25h-4.5c-.69 0-1.25-.56-1.25-1.25v-4.5Z" />
        </svg>
      </Btn>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-lg p-3 w-72">
          <p className="text-xs font-medium text-slate-600 mb-1.5">Link URL</p>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500 mb-2"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button"
              onMouseDown={() => { if (url.trim()) { onInsert(url.trim()); setUrl(""); setOpen(false); } }}
              className="flex-1 py-1 rounded bg-navy-900 text-white text-xs font-medium hover:bg-navy-700"
            >
              Insert
            </button>
            <button type="button" onMouseDown={() => { onRemove(); setOpen(false); }} className="px-3 py-1 rounded border text-xs text-slate-600 hover:bg-slate-50">
              Remove
            </button>
            <button type="button" onMouseDown={() => setOpen(false)} className="px-2 py-1 rounded border text-xs text-slate-500">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main editor ──────────────────────────────────────────────────────────────

const FONTS = [
  { label: "Default", value: "" },
  { label: "Serif", value: "Georgia, serif" },
  { label: "Mono", value: "ui-monospace, monospace" },
];

export function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
      }),
      Underline,
      TextStyle,
      FontFamily,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-navy-700 underline" } }),
      Image.configure({ HTMLAttributes: { class: "max-w-full rounded" } }),
      Placeholder.configure({ placeholder: placeholder ?? "Write your article here…" }),
      CharacterCount,
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "outline-none min-h-[400px] prose-editor",
      },
    },
  });

  const setLink = useCallback((url: string) => {
    if (!editor) return;
    editor.chain().focus().setLink({ href: url, target: "_blank" }).run();
  }, [editor]);

  const removeLink = useCallback(() => {
    editor?.chain().focus().unsetLink().run();
  }, [editor]);

  if (!editor) return null;

  const headingValue = editor.isActive("heading", { level: 1 }) ? "h1"
    : editor.isActive("heading", { level: 2 }) ? "h2"
    : editor.isActive("heading", { level: 3 }) ? "h3"
    : editor.isActive("heading", { level: 4 }) ? "h4"
    : "p";

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-200 bg-slate-50 px-2 py-1.5 flex flex-wrap items-center gap-0.5">

        {/* Block type */}
        <select
          value={headingValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "p") editor.chain().focus().setParagraph().run();
            else editor.chain().focus().setHeading({ level: parseInt(v[1]) as 1|2|3|4 }).run();
          }}
          className="h-7 px-1.5 rounded border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-navy-500 cursor-pointer"
        >
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="h4">Heading 4</option>
        </select>

        {/* Font family */}
        <select
          value={FONTS.find(f => f.value && editor.isActive("textStyle", { fontFamily: f.value }))?.value ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) editor.chain().focus().unsetFontFamily().run();
            else editor.chain().focus().setFontFamily(v).run();
          }}
          className="h-7 px-1.5 rounded border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-navy-500 cursor-pointer ml-0.5"
        >
          {FONTS.map(f => <option key={f.label} value={f.value}>{f.label}</option>)}
        </select>

        <Divider />

        {/* Inline marks */}
        <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold (⌘B)">
          <strong>B</strong>
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic (⌘I)">
          <em>I</em>
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline (⌘U)">
          <span className="underline">U</span>
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough">
          <span className="line-through">S</span>
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} title="Inline code">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path fillRule="evenodd" d="M5.28 4.22a.75.75 0 0 1 0 1.06L3.56 7l1.72 1.72a.75.75 0 1 1-1.06 1.06L1.97 7.53a.75.75 0 0 1 0-1.06l2.25-2.25a.75.75 0 0 1 1.06 0Zm5.44 0a.75.75 0 0 1 1.06 0l2.25 2.25a.75.75 0 0 1 0 1.06l-2.25 2.25a.75.75 0 1 1-1.06-1.06L12.44 7l-1.72-1.72a.75.75 0 0 1 0-1.06ZM7.655 3.93a.75.75 0 0 1 .415.972l-2.5 6.5a.75.75 0 0 1-1.387-.557l2.5-6.5a.75.75 0 0 1 .972-.415Z" clipRule="evenodd" />
          </svg>
        </Btn>

        <Divider />

        {/* Colour pickers */}
        <ColorPicker
          colors={TEXT_COLORS}
          label="Text colour"
          onSelect={(c) => c ? editor.chain().focus().setColor(c).run() : editor.chain().focus().unsetColor().run()}
        />
        <ColorPicker
          colors={HIGHLIGHT_COLORS}
          label="Highlight"
          onSelect={(c) => c ? editor.chain().focus().toggleHighlight({ color: c }).run() : editor.chain().focus().unsetHighlight().run()}
        />

        <Divider />

        {/* Alignment */}
        <Btn onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Align left">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path fillRule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM2 8a.75.75 0 0 1 .75-.75h6.5a.75.75 0 0 1 0 1.5h-6.5A.75.75 0 0 1 2 8Zm0 3.25a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
          </svg>
        </Btn>
        <Btn onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Align center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path fillRule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM4.5 8a.75.75 0 0 1 .75-.75h5.5a.75.75 0 0 1 0 1.5h-5.5A.75.75 0 0 1 4.5 8Zm-2 3.25a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
          </svg>
        </Btn>
        <Btn onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Align right">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path fillRule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM7.25 8a.75.75 0 0 1 .75-.75h5.25a.75.75 0 0 1 0 1.5H8a.75.75 0 0 1-.75-.75Zm-5.25 3.25A.75.75 0 0 1 2.75 11h10.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
          </svg>
        </Btn>

        <Divider />

        {/* Lists */}
        <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet list">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path fillRule="evenodd" d="M2 4a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm3.75-.75a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5h-7.5ZM2 8a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm3.75-.75a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5h-7.5ZM3 12a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm2.75-.75a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5h-7.5Z" clipRule="evenodd" />
          </svg>
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered list">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path fillRule="evenodd" d="M3 2a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0V3.207l-.146.147a.5.5 0 1 1-.708-.708l1-1A.5.5 0 0 1 3 1.5Zm0 5.5a.5.5 0 0 1 .5.5c0 .2-.065.378-.168.516l-.046.058L2.5 10h.25a.5.5 0 0 1 .09.992L2.75 11H1.5a.5.5 0 0 1-.395-.808l1.16-1.45A.5.5 0 0 0 2 8.5a.5.5 0 0 1-1 0A1.5 1.5 0 0 1 3 7Zm.5 5.5a.5.5 0 0 0-.5.5A1.5 1.5 0 0 0 4.5 15h.5V14h-.5a.5.5 0 0 1-.5-.5.5.5 0 0 1 .5-.5H5V12h-.5a.5.5 0 0 1-.5-.5.5.5 0 0 1 .5-.5H5v-1H3.5a.5.5 0 0 0 0 1H4v.5H3.5a1.5 1.5 0 0 0-1.5 1.5ZM6.75 4a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5h-7.5Zm0 5a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5h-7.5Zm0 5a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5h-7.5Z" clipRule="evenodd" />
          </svg>
        </Btn>

        <Divider />

        {/* Block elements */}
        <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Blockquote">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M7.145 1.438a1 1 0 0 1 .227 1.395C6.116 4.5 5.5 6.066 5.5 8c0 1.11.36 2.065.955 2.78.382.46.284 1.12-.176 1.505-.46.386-1.12.288-1.507-.172C3.676 10.848 3 9.527 3 8c0-2.56.81-4.63 2.254-6.29a1 1 0 0 1 1.891-.272Zm5.5 0a1 1 0 0 1 .228 1.395C11.616 4.5 11 6.066 11 8c0 1.11.36 2.065.955 2.78.382.46.284 1.12-.176 1.505-.46.386-1.12.288-1.507-.172C9.176 10.848 8.5 9.527 8.5 8c0-2.56.81-4.63 2.254-6.29a1 1 0 0 1 1.891-.272Z" />
          </svg>
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")} title="Code block">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M3.75 2a.75.75 0 0 0-.75.75v10.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75V6.56a.75.75 0 0 0-.22-.53L9.22 2.22a.75.75 0 0 0-.53-.22H3.75Z" />
          </svg>
        </Btn>
        <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule">
          <span className="text-xs font-bold">—</span>
        </Btn>

        <Divider />

        {/* Link + Image */}
        <LinkInsert onInsert={setLink} onRemove={removeLink} />
        <ImageInsert onInsert={(url) => editor.chain().focus().setImage({ src: url }).run()} />

        <Divider />

        {/* Undo / Redo */}
        <Btn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo (⌘Z)">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path fillRule="evenodd" d="M1.22 6.53a.75.75 0 0 0 1.06 0L4 4.81V8.5a5.25 5.25 0 0 0 10.5 0 .75.75 0 0 0-1.5 0 3.75 3.75 0 0 1-7.5 0V4.81l1.72 1.72a.75.75 0 1 0 1.06-1.06l-3-3a.75.75 0 0 0-1.06 0l-3 3a.75.75 0 0 0 0 1.06Z" clipRule="evenodd" />
          </svg>
        </Btn>
        <Btn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo (⌘⇧Z)">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path fillRule="evenodd" d="M14.78 6.53a.75.75 0 0 1-1.06 0L12 4.81V8.5a5.25 5.25 0 0 1-10.5 0 .75.75 0 0 1 1.5 0 3.75 3.75 0 0 0 7.5 0V4.81l-1.72 1.72a.75.75 0 1 1-1.06-1.06l3-3a.75.75 0 0 1 1.06 0l3 3a.75.75 0 0 1 0 1.06Z" clipRule="evenodd" />
          </svg>
        </Btn>

        <Divider />

        {/* Clear formatting */}
        <Btn onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title="Clear formatting">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M7.72 1.22a.75.75 0 0 1 1.06 0l6 6a.75.75 0 0 1 0 1.06l-3 3a.75.75 0 0 1-1.06-1.06l.47-.47-5.69-5.69-.47.47A.75.75 0 0 1 3.97 3.5l3.75-2.28ZM3.06 7.06l5.69 5.69-1.5 1.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 0 1 0-1.06l1.37-1.63Z" />
          </svg>
        </Btn>
      </div>

      {/* ── Editor area ──────────────────────────────────────────────────── */}
      <div className="px-6 py-5 min-h-[420px]">
        <style>{`
          .prose-editor h1 { font-size: 2em; font-weight: 700; margin: 0.67em 0; line-height: 1.2; }
          .prose-editor h2 { font-size: 1.5em; font-weight: 700; margin: 0.83em 0; line-height: 1.3; }
          .prose-editor h3 { font-size: 1.17em; font-weight: 600; margin: 1em 0; }
          .prose-editor h4 { font-size: 1em; font-weight: 600; margin: 1.33em 0; }
          .prose-editor p  { margin: 0.5em 0; line-height: 1.7; }
          .prose-editor ul { list-style: disc; padding-left: 1.5em; margin: 0.5em 0; }
          .prose-editor ol { list-style: decimal; padding-left: 1.5em; margin: 0.5em 0; }
          .prose-editor li { margin: 0.25em 0; line-height: 1.6; }
          .prose-editor blockquote { border-left: 3px solid #e2e8f0; padding-left: 1em; color: #64748b; margin: 1em 0; font-style: italic; }
          .prose-editor pre  { background: #1e293b; color: #e2e8f0; padding: 1em; border-radius: 0.5em; overflow-x: auto; margin: 1em 0; font-size: 0.875em; }
          .prose-editor code { background: #f1f5f9; padding: 0.15em 0.35em; border-radius: 0.25em; font-size: 0.875em; }
          .prose-editor pre code { background: transparent; padding: 0; }
          .prose-editor hr  { border: none; border-top: 2px solid #e2e8f0; margin: 1.5em 0; }
          .prose-editor img { max-width: 100%; border-radius: 0.5em; margin: 0.5em 0; }
          .prose-editor a   { color: #1e3a5f; text-decoration: underline; }
          .tiptap p.is-editor-empty:first-child::before { color: #94a3b8; content: attr(data-placeholder); float: left; height: 0; pointer-events: none; }
        `}</style>
        <EditorContent editor={editor} />
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div className="border-t border-slate-100 px-4 py-1.5 flex items-center justify-end text-xs text-slate-400 bg-slate-50">
        {editor.storage.characterCount.characters()} characters ·{" "}
        {editor.storage.characterCount.words()} words
      </div>
    </div>
  );
}
