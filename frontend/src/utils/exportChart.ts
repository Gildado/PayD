function getChartSvg(container: HTMLElement): SVGSVGElement | null {
  const svg = container.querySelector('svg');
  return svg instanceof SVGSVGElement ? svg : null;
}

// Chart series (see DESIGN_TOKENS.md's --chart-1..--chart-8 palette) are
// styled via `stroke="var(--chart-N)"` / `fill="var(--chart-N)"`, resolved
// against the live page's :root theme. A raw clone still carries the
// literal "var(--chart-N)" string, which has nothing to resolve against
// once the file leaves this page (opened standalone, emailed, pasted
// elsewhere) -- exported charts would show broken/invisible colors instead
// of the theme's actual palette. Resolves each `var(...)` reference to its
// computed value (read from the still-attached original, not the detached
// clone -- getComputedStyle can't resolve custom properties on a node
// that isn't part of the render tree) so exports are self-contained.
const COLOR_ATTRS = ['stroke', 'fill', 'stop-color'] as const;

function inlineComputedColors(original: SVGSVGElement, clone: SVGSVGElement): void {
  const originalNodes = [original, ...Array.from(original.querySelectorAll('*'))];
  const cloneNodes = [clone, ...Array.from(clone.querySelectorAll('*'))];

  originalNodes.forEach((originalNode, i) => {
    const cloneNode = cloneNodes[i];
    if (!(cloneNode instanceof SVGElement) || !(originalNode instanceof SVGElement)) return;

    const computed = getComputedStyle(originalNode);
    for (const attr of COLOR_ATTRS) {
      const value = cloneNode.getAttribute(attr);
      if (!value || !value.includes('var(')) continue;
      const cssProp = attr === 'stop-color' ? 'stopColor' : attr;
      const resolved = computed.getPropertyValue(cssProp) || computed.getPropertyValue(attr);
      if (resolved) cloneNode.setAttribute(attr, resolved.trim());
    }
  });
}

function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  inlineComputedColors(svg, clone);
  const serializer = new XMLSerializer();
  return serializer.serializeToString(clone);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportAsSvg(container: HTMLElement, filename = 'chart.svg'): void {
  const svg = getChartSvg(container);
  if (!svg) return;
  const svgString = serializeSvg(svg);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(blob, filename);
}

export function exportAsPng(container: HTMLElement, filename = 'chart.png'): void {
  const svg = getChartSvg(container);
  if (!svg) return;

  const svgString = serializeSvg(svg);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const rect = svg.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0, rect.width, rect.height);
      canvas.toBlob((blob) => {
        if (blob) downloadBlob(blob, filename);
        URL.revokeObjectURL(url);
      }, 'image/png');
    } else {
      URL.revokeObjectURL(url);
    }
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
  };
  img.src = url;
}
