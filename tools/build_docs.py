"""Build the document center from repository guides and public evidence (requires Python-Markdown)."""

from __future__ import annotations

import argparse
import hashlib
import html
import json
from pathlib import Path
import posixpath
import re
import sys
from urllib.parse import quote, unquote, urlsplit

try:
    import markdown
    from markdown.extensions.toc import slugify_unicode
except ImportError:
    raise SystemExit("This script requires Python-Markdown: python -m pip install Markdown")


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
PUBLIC = ROOT / "frontend" / "public"
DOCUMENTS = {
    "guide": ("docs/README.md", "阅读导航", "reading-guide.md"),
    "startup": ("README.md", "启动运行", "getting-started.md"),
    "intro": ("docs/项目介绍.md", "项目介绍", "project-introduction.md"),
    "requirements": ("docs/需求文档.md", "需求文档", "requirements.md"),
    "api": ("docs/接口文档.md", "接口文档", "api.md"),
    "database": ("sql/README.md", "数据库说明", "database-guide.md"),
    "verification": ("docs/验收记录.md", "验收记录", "verification.md"),
    "demo": ("docs/演示数据.md", "演示数据", "demo-data.md"),
    "plan": ("docs/学习规划.md", "学习规划", "study-plan.md"),
}
SOURCE_KEYS = {(ROOT / value[0]).resolve(): key for key, value in DOCUMENTS.items()}
# Only these public verification artifacts are copied; runtime and local settings are never inputs.
ASSETS = {(ROOT / "sql/004_demo_data_checks.sql").resolve(): "demo-data-checks.sql"}
ASSETS.update({path.resolve(): "verification/" + path.name
               for path in sorted((DOCS / "verification").iterdir())
               if path.is_file() and path.suffix in {".json", ".png"}})
ASSET_TOKENS = {path: f"__DOC_ASSET_{index}__" for index, path in enumerate(ASSETS)}


def render_documents():
    rendered = {}
    sources = {}
    json_count = 0
    for key, (filename, label, _) in DOCUMENTS.items():
        source_path = (ROOT / filename).resolve()
        source = source_path.read_text(encoding="utf-8-sig")
        if key == "database":
            checks = (ROOT / "sql/004_demo_data_checks.sql").read_text(encoding="utf-8-sig")
            source += ("\n\n## 展示数据核对 SQL（只读）\n\n"
                       "以下附录直接由核对脚本生成，阅读页面不会执行 SQL。"
                       "脚本选择常用 xuexu 库，检查测试库时应使用对应连接。\n\n"
                       "```sql\n" + checks.rstrip() + "\n```\n")
        sources[key] = source
        for number, block in enumerate(re.findall(r"```json\s*\n(.*?)\n```", source, re.S), 1):
            try:
                json.loads(block)
            except ValueError as error:
                raise ValueError(f"{filename}: invalid JSON example {number}: {error}") from error
            json_count += 1
        md = markdown.Markdown(
            extensions=["tables", "fenced_code", "toc", "sane_lists"],
            extension_configs={
                "toc": {"slugify": lambda value, sep, prefix=key: prefix + "-" + slugify_unicode(value, sep)}
            },
        )
        body = md.convert(source)

        def rewrite_link(match):
            href = html.unescape(match[1])
            url = urlsplit(href)
            if url.scheme or url.netloc or href.startswith("/"):
                return match[0]
            target = ((source_path.parent / unquote(url.path)).resolve()
                      if url.path else source_path)
            dest = "guide" if target == DOCS / "index.html" else SOURCE_KEYS.get(target)
            if dest:
                fragment = unquote(url.fragment)
                if fragment and not fragment.startswith(dest + "-"):
                    fragment = dest + "-" + fragment
                href = "#" + dest + (":" + fragment if fragment else "")
            elif target in ASSET_TOKENS:
                href = ASSET_TOKENS[target]
            else:
                raise ValueError(f"Unregistered local link in {filename}: {href}")
            return 'href="' + html.escape(href, quote=True) + '"'

        body = re.sub(r'href="([^"]+)"', rewrite_link, body)
        body = body.replace("<table>", '<div class="table-wrap"><table>').replace("</table>", "</table></div>")
        body = body.replace("<li>[ ] ", '<li class="task"><span class="todo" aria-hidden="true">□</span> ')
        rendered[key] = body

    # Every generated in-document/cross-document anchor must resolve.
    ids = {key: set(re.findall(r'id="([^"]+)"', body)) for key, body in rendered.items()}
    for key, body in rendered.items():
        all_ids = re.findall(r'id="([^"]+)"', body)
        if len(all_ids) != len(set(all_ids)):
            raise ValueError(f"Duplicate HTML anchor in {key}")
        for href in re.findall(r'href="(#[^"]*)"', body):
            document, separator, anchor = html.unescape(href[1:]).partition(":")
            if document not in rendered or (separator and unquote(anchor) not in ids[document]):
                raise ValueError(f"Unresolved link in {key}: {href}")
    return rendered, sources, json_count


STYLE = r"""
:root{--ink:#182d42;--muted:#65778b;--navy:#132d44;--teal:#087f83;--line:#dce5ec;--paper:#fff;--soft:#f3f7fa;--blue:#235ca8;--code:#142b3b;color-scheme:light;font-family:Inter,"Segoe UI","Microsoft YaHei",sans-serif}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:112px}body{margin:0;color:var(--ink);background:var(--soft);font-size:15px;line-height:1.8}a{color:var(--blue);text-decoration:none}a:hover{text-decoration:underline}button,input{font:inherit}button{cursor:pointer}button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid #52a9c9;outline-offset:3px}[hidden]{display:none!important}
.top{position:sticky;top:0;z-index:20;background:var(--navy);color:#fff;box-shadow:0 2px 14px #132d4414}.top-inner{max-width:1500px;margin:auto;padding:14px 30px;display:flex;align-items:center;gap:16px}.mark{display:grid;place-items:center;width:34px;height:34px;border:1px solid #85d7d4;border-radius:9px;font-weight:700;color:#bcf3eb}.brand{font-size:17px;font-weight:700;letter-spacing:.02em}.sub{font-size:12px;color:#bfd1e0;margin-left:10px}.top-actions{margin-left:auto;display:flex;gap:10px;align-items:center}.top-actions a,.top-actions button{color:#e4f3fa;background:transparent;border:1px solid #5c758a;border-radius:7px;padding:5px 12px;font-size:13px}.tabs{display:flex;gap:6px;padding:0 30px;max-width:1500px;margin:auto}.tabs a{display:block;padding:9px 21px;color:#c9d8e4;font-size:14px;border-radius:7px 7px 0 0}.tabs a[aria-current=page]{background:var(--soft);color:var(--navy);font-weight:700}.tabs a:hover{text-decoration:none;background:#304c64}.tabs a[aria-current=page]:hover{background:var(--soft)}
.layout{max-width:1500px;display:grid;grid-template-columns:260px minmax(0,1fr);margin:auto;align-items:start}.sidebar{position:sticky;top:103px;padding:26px 20px 28px 28px;max-height:calc(100vh - 105px);overflow:auto}.side-label{font-size:11px;letter-spacing:.12em;color:var(--muted);font-weight:700;margin:0 0 10px}.search{width:100%;border:1px solid #c9d7e2;border-radius:8px;padding:9px 10px;background:white;line-height:1.4;color:var(--ink);font-size:13px}.search-note{font-size:11px;color:var(--muted);margin:7px 0 20px}.toc a{display:block;color:#486176;padding:6px 10px;border-left:2px solid transparent;font-size:12px;line-height:1.5;margin:2px 0}.toc a.depth3{padding-left:22px;color:#708397;font-size:11px}.toc a:hover{background:#e7eff5;border-color:var(--teal);text-decoration:none;color:var(--teal)}.source-note{font-size:11px;color:#7e8d9c;margin:20px 10px;line-height:1.7}.content{padding:28px 34px 70px 18px;min-width:0}.hero{border:1px solid var(--line);border-radius:12px;background:linear-gradient(120deg,#e7f5f3,#f4f8fc);padding:20px 26px;margin-bottom:20px}.eyebrow{font-size:10px;letter-spacing:.16em;color:var(--teal);font-weight:800}.hero h2{font-size:22px;margin:4px 0 5px}.hero p{font-size:12px;color:#536d7d;margin:0}.pill-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.pill{font-size:10px;color:#36675f;background:#ffffffa8;border:1px solid #c6e1dc;padding:3px 9px;border-radius:30px}
.document{background:var(--paper);padding:30px 34px 45px;border:1px solid var(--line);border-radius:12px;min-width:0;overflow-wrap:anywhere}.document h1{font-size:27px;line-height:1.4;letter-spacing:-.02em;margin:0 0 16px;color:var(--navy)}.document h2{margin:38px 0 16px;font-size:21px;padding-bottom:9px;border-bottom:2px solid #d8e8ec;color:var(--navy);line-height:1.5}.document h3{margin:29px 0 12px;font-size:17px;color:#176d77;line-height:1.55}.document h4{margin:22px 0 10px;font-size:15px;color:#24485c}.document p{margin:12px 0}.document ul,.document ol{padding-left:24px;margin:12px 0}.document li{margin:5px 0}.task{list-style:none;margin-left:-18px!important}.todo{font-size:18px;color:#618696;margin-right:7px}.document blockquote{border-left:4px solid #35a2a2;background:#f0f8f8;margin:20px 0;padding:10px 17px;color:#3d6570;font-size:13px;border-radius:0 6px 6px 0}.document blockquote p{margin:3px 0}.document :not(pre)>code{background:#edf3f7;color:#294c6a;border:1px solid #e1eaf0;border-radius:4px;font-size:.86em;padding:1px 5px;font-family:Consolas,"Cascadia Code",monospace;overflow-wrap:anywhere}.document pre{position:relative;margin:17px 0;background:var(--code);color:#dcecf4;padding:22px 18px 18px;border-radius:9px;overflow:auto;line-height:1.65;font-size:12px}.document pre code{font-family:Consolas,"Cascadia Code",monospace;white-space:pre}.copy{position:absolute;right:9px;top:7px;font-size:10px;padding:1px 7px;border:1px solid #608293;background:#24475a;color:#e4f3fa;border-radius:4px}.table-wrap{overflow:auto;margin:18px 0;border:1px solid var(--line);border-radius:8px}table{border-collapse:collapse;width:100%;font-size:12px;line-height:1.7;min-width:480px}th{background:#edf4f8;text-align:left;color:#20465e;font-weight:700}td,th{padding:10px 12px;border-bottom:1px solid #e4ecf2;vertical-align:top}td+td,th+th{border-left:1px solid #edf1f5}tr:last-child td{border-bottom:0}tbody tr:nth-child(even){background:#fbfcfd}.document table code{font-size:11px!important}.document hr{border:0;border-top:1px solid var(--line);margin:30px 0}.search-results{margin-bottom:20px;border:1px solid #bad8df;border-radius:10px;padding:18px 20px;background:#f5fbfb}.search-results h3{margin:0 0 10px;font-size:14px;color:#12676f}.result{display:block;border-top:1px solid #d9e9ec;padding:9px 0;font-size:13px}.result small{display:block;color:#738a96;font-size:11px}.footer{font-size:11px;color:#7e8e9e;padding:18px 3px}.menu{display:none}
@media(min-width:1650px){.document{padding:40px 48px}.content{padding-right:45px}}
@media(max-width:950px){.layout{grid-template-columns:210px minmax(0,1fr)}.sidebar{padding-left:15px;padding-right:14px}.content{padding:20px 16px 40px 0}.document{padding:24px}.sub{display:none}.hero{padding:17px 21px}.top-inner{padding:12px 18px}.tabs{padding:0 18px}}
@media(max-width:720px){.layout{display:block}.sidebar{display:none;position:fixed;top:101px;bottom:0;left:0;z-index:15;width:275px;max-height:none;background:#f3f7fa;box-shadow:10px 0 30px #132d4420}.sidebar.open{display:block}.menu{display:inline-block}.content{padding:14px 12px 35px}.document{padding:23px 18px}.document h1{font-size:23px}.document h2{font-size:19px}.brand{font-size:15px}.top-inner{gap:9px;padding:12px}.top-actions a{display:none}.top-actions button{font-size:11px;padding:4px 8px}.tabs{padding:0 12px}.tabs a{padding:8px 15px}.hero{padding:16px 18px}.hero h2{font-size:19px}}
@media print{body{background:#fff;font-size:10pt}.top,.sidebar,.hero,.footer,.copy,.search-results{display:none!important}.layout{display:block;max-width:none}.content{padding:0}.document{border:0;padding:0;border-radius:0}.document h1{font-size:23pt}.document h2{font-size:16pt;break-after:avoid}.document h3,.document h4{break-after:avoid}.table-wrap{overflow:visible;border-radius:0}table{min-width:0;font-size:8pt}th,td{padding:6px 8px}.document pre{white-space:pre-wrap;overflow:visible;background:#f0f3f5;color:#182d42;break-inside:avoid}.document pre code{white-space:pre-wrap;word-break:break-word}.document a{color:inherit}.document blockquote{break-inside:avoid}thead{display:table-header-group}tr{break-inside:avoid}@page{size:A4;margin:16mm}}
"""

SCRIPT = r"""
(() => {
  const docs = [...document.querySelectorAll('.document')];
  const titles = __TITLES__;
  const downloads = __DOWNLOADS__;
  const defaultDoc = __DEFAULT__;
  const toc = document.getElementById('toc');
  const sidebar = document.getElementById('sidebar');
  const search = document.getElementById('search');
  const results = document.getElementById('search-results');
  let current = defaultDoc;
  const headings = docs.flatMap(article => [...article.querySelectorAll('h2,h3,h4')].map(heading => {
    let text = heading.textContent;
    for (let next = heading.nextElementSibling; next && !/^H[1-4]$/.test(next.tagName); next = next.nextElementSibling) text += ' ' + next.textContent;
    return {doc:article.dataset.doc, id:heading.id, title:heading.textContent, text:text.toLocaleLowerCase()};
  }));
  function route() {
    let raw;
    try { raw = decodeURIComponent(location.hash.slice(1)); } catch { raw = ''; }
    let [key, ...parts] = raw.split(':');
    let id = parts.join(':');
    if (!Object.prototype.hasOwnProperty.call(titles, key)) {
      const legacy = raw && docs.find(doc => [...doc.querySelectorAll('[id]')].some(node => node.id === raw));
      key = legacy ? legacy.dataset.doc : defaultDoc;
      id = legacy ? raw : '';
    }
    current = key;
    docs.forEach(doc => { doc.hidden = doc.dataset.doc !== key; });
    document.querySelectorAll('.tabs a').forEach(a => { if (a.dataset.tab === key) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
    document.getElementById('doc-name').textContent = titles[key];
    document.getElementById('download').href = downloads[key];
    document.getElementById('download').download = downloads[key].split('/').pop();
    document.title = '学序 · ' + titles[key] + ' | 项目文档';
    toc.replaceChildren();
    headings.filter(h => h.doc === key && !document.getElementById(h.id).matches('h4')).forEach(h => {
      const a = document.createElement('a'); a.href = '#' + key + ':' + h.id; a.textContent = h.title;
      if (document.getElementById(h.id).matches('h3')) a.className = 'depth3'; toc.appendChild(a);
    });
    sidebar.classList.remove('open'); document.getElementById('menu').setAttribute('aria-expanded','false');
    requestAnimationFrame(() => {
      const target = id && document.getElementById(id);
      if (target) target.scrollIntoView({block:'start'}); else window.scrollTo(0,0);
    });
  }
  window.addEventListener('hashchange', route);
  document.getElementById('menu').addEventListener('click', () => {
    const open = sidebar.classList.toggle('open'); document.getElementById('menu').setAttribute('aria-expanded',String(open));
  });
  document.getElementById('print').addEventListener('click', () => window.print());
  document.querySelectorAll('pre').forEach(pre => {
    const button = document.createElement('button'); button.className = 'copy'; button.type = 'button'; button.textContent = '复制';
    button.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(pre.querySelector('code').textContent); button.textContent = '已复制'; }
      catch { button.textContent = '请选择文本复制'; }
      setTimeout(() => button.textContent = '复制',1800);
    }); pre.appendChild(button);
  });
  search.addEventListener('input', () => {
    const query = search.value.trim().toLocaleLowerCase(); results.replaceChildren();
    if (!query) { results.hidden = true; return; }
    const found = headings.filter(h => h.title.toLocaleLowerCase().includes(query) || h.text.includes(query));
    results.hidden = false;
    const title = document.createElement('h3'); title.textContent = `找到 ${found.length} 个相关章节（显示前 30 项）`; results.appendChild(title);
    found.slice(0,30).forEach(h => {
      const a = document.createElement('a'); a.className = 'result'; a.href = '#' + h.doc + ':' + h.id;
      a.textContent = h.title; const small = document.createElement('small'); small.textContent = titles[h.doc]; a.appendChild(small);
      a.addEventListener('click', () => { results.hidden = true; search.value = ''; }); results.appendChild(a);
    });
  });
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); if (innerWidth<=720) sidebar.classList.add('open'); search.focus(); }
    if (event.key === 'Escape') { results.hidden = true; search.value = ''; sidebar.classList.remove('open'); }
  });
  route();
})();
"""


def build_html(rendered, sources, public=False, default="guide"):
    download_map = {key: (value[2] if public else posixpath.relpath(value[0], "docs"))
                    for key, value in DOCUMENTS.items()}
    return_link = '<a href="/">返回系统 ↗</a>' if public else ""
    tabs = "".join(f'<a href="#{key}" data-tab="{key}">{html.escape(value[1])}</a>'
                   for key, value in DOCUMENTS.items())
    articles = "\n".join(
        f'<article class="document" id="document-{key}" data-doc="{key}"'
        + ("" if key == default else " hidden")
        + f'>{body}</article>' for key, body in rendered.items()
    )
    for path, token in ASSET_TOKENS.items():
        asset_url = (ASSETS[path] if public
                     else posixpath.relpath(path.relative_to(ROOT).as_posix(), "docs"))
        articles = articles.replace(token, html.escape(quote(asset_url), quote=True))
    digest = hashlib.sha256("".join(sources.values()).encode("utf-8")).hexdigest()[:12]
    script = (SCRIPT.replace("__DOWNLOADS__", json.dumps(download_map, ensure_ascii=False))
              .replace("__TITLES__", json.dumps({key: value[1] for key, value in DOCUMENTS.items()}, ensure_ascii=False))
              .replace("__DEFAULT__", json.dumps(default)))
    return f"""<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="学序统一项目文档：阅读导航、启动运行、需求、接口、数据库、验收清单、报告与学习规划。">
<title>学序 · 项目文档</title><style>{STYLE}</style></head><body>
<header class="top"><div class="top-inner"><span class="mark">序</span><span class="brand">学序 EduFlow</span><span class="sub">PROJECT DOCUMENTATION</span>
<div class="top-actions">{return_link}<a id="download" href="{quote(download_map[default])}" download>下载 Markdown</a><button id="print" type="button">打印 / 保存 PDF</button><button id="menu" class="menu" aria-controls="sidebar" aria-expanded="false" type="button">目录</button></div></div>
<nav class="tabs" aria-label="文档类型" style="overflow-x:auto;white-space:nowrap">{tabs}</nav></header>
<div class="layout"><aside class="sidebar" id="sidebar"><p class="side-label">SEARCH &amp; CONTENTS</p><label for="search" class="side-label">搜索全部文档</label><input class="search" id="search" type="search" placeholder="搜索需求、接口或集数…" autocomplete="off"><p class="search-note">Ctrl / Cmd + K · 输入关键词搜索章节</p><section id="search-results" class="search-results" aria-live="polite" hidden></section><nav id="toc" class="toc" aria-label="当前文档目录"></nav><p class="source-note">基线：2026-10-23<br>以 Markdown 为维护源<br>生成版本：{digest}</p></aside>
<main class="content"><section class="hero"><div class="eyebrow">LEARN · BUILD · VERIFY</div><h2 id="doc-name">{DOCUMENTS[default][1]}</h2><p>从这里阅读说明、规范启动、核对数据并逐项验收，无需在项目目录中来回寻找。</p><div class="pill-row"><span class="pill">启动与验收</span><span class="pill">管理员 / 教师 / 学生</span><span class="pill">数据库与验证附件</span><span class="pill">P84–200 学习索引</span></div></section>
{articles}
<footer class="footer">学序项目文档 · 由 tools/build_docs.py 生成 · 文档中的目标和示例不代表功能已经验收。</footer></main></div><script>{script}</script></body></html>
"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Check generated files without writing")
    args = parser.parse_args()
    rendered, sources, json_count = render_documents()
    outputs = {
        DOCS / "index.html": build_html(rendered, sources),
        PUBLIC / "project-docs.html": build_html(rendered, sources, public=True),
        PUBLIC / "api-docs.html": build_html(rendered, sources, public=True, default="api"),
    }
    for key, (_, _, public_name) in DOCUMENTS.items():
        outputs[PUBLIC / public_name] = sources[key]
    outputs = {path: value.encode("utf-8") for path, value in outputs.items()}
    for path, public_name in ASSETS.items():
        if path.suffix == ".json":
            json.loads(path.read_text(encoding="utf-8-sig"))
        outputs[PUBLIC / public_name] = path.read_bytes()
    stale = []
    for path, expected in outputs.items():
        if args.check:
            if not path.exists() or path.read_bytes() != expected:
                stale.append(path.relative_to(ROOT).as_posix())
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(expected)
    if stale:
        print("Generated files need updating:\n" + "\n".join(stale))
        return 1
    print(f"{'Checked' if args.check else 'Generated'} {len(outputs)} files from {len(DOCUMENTS)} documents; {json_count} JSON examples parsed; all internal links resolved; {len(ASSETS)} attachments checked.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
