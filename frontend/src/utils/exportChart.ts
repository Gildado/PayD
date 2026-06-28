function getChartSvg(container: HTMLElement): SVGSVGElement | null {
  const svg = container.querySelector('svg');
  return svg instanceof SVGSVGElement ? svg : null;
}

function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
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
