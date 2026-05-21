import { printCss } from "./printCss";

const FONT_LINK = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
`;

const MERMAID_CDN = `https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs`;

const MERMAID_SCRIPT = `
<script type="module">
  import mermaid from "${MERMAID_CDN}";
  window.__mermaidReady = false;
  mermaid.initialize({
    startOnLoad: false,
    theme: "default",
    themeVariables: {
      fontFamily: "'Inter Tight', sans-serif",
      primaryColor: "#eef2ff",
      primaryBorderColor: "#4f46e5",
      primaryTextColor: "#111317",
      lineColor: "#5b6470",
    },
    flowchart: { htmlLabels: true, curve: "basis" },
    sequence: { useMaxWidth: true, mirrorActors: false },
    er: { useMaxWidth: true },
  });
  try {
    await mermaid.run({ querySelector: ".mermaid-wrapper > pre.mermaid" });
  } catch (e) {
    console.error("mermaid failed", e);
  }

  const PX_PER_MM = 96 / 25.4;
  const usableW = (210 - 18 - 18) * PX_PER_MM * 0.94;
  const usableH = (297 - 22 - 24) * PX_PER_MM * 0.90;
  const MAX_UPSCALE = 1.6;
  for (const w of document.querySelectorAll(".mermaid-wrapper")) {
    const svg = w.querySelector("svg");
    if (!svg) continue;
    const vb = svg.viewBox && svg.viewBox.baseVal;
    let natW, natH;
    if (vb && vb.width > 0 && vb.height > 0) {
      natW = vb.width;
      natH = vb.height;
    } else {
      svg.removeAttribute("width");
      svg.removeAttribute("height");
      svg.style.width = ""; svg.style.height = ""; svg.style.maxWidth = "none";
      const bb = svg.getBoundingClientRect();
      natW = bb.width || 1; natH = bb.height || 1;
    }
    const ratio = natW / natH;
    let targetW = Math.min(usableW, natW * MAX_UPSCALE);
    let targetH = targetW / ratio;
    if (targetH > usableH) {
      targetH = usableH;
      targetW = targetH * ratio;
    }
    if (targetH > natH * MAX_UPSCALE) {
      targetH = natH * MAX_UPSCALE;
      targetW = targetH * ratio;
    }
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.style.maxWidth = "none";
    svg.style.width = targetW + "px";
    svg.style.height = targetH + "px";
    svg.style.transform = "";
    w.style.height = "";
    w.style.width = "";
  }
  window.__mermaidReady = true;
</script>
`;

export function buildHtml({ title, body }: { title: string; body: string }): string {
  const safeTitle = title.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${safeTitle}</title>
${FONT_LINK}
<style>${printCss}</style>
</head>
<body>
${body}
${MERMAID_SCRIPT}
</body>
</html>`;
}
