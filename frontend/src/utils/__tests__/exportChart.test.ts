import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportAsSvg } from '../exportChart';

describe('exportChart', () => {
  let container: HTMLElement;
  let anchorClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement('div');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100');
    svg.setAttribute('height', '100');
    container.appendChild(svg);

    anchorClick = vi.fn();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        const anchor = origCreateElement('a');
        anchor.click = anchorClick;
        return anchor;
      }
      return origCreateElement(tagName);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exportAsSvg creates a download with SVG content', () => {
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL');
    exportAsSvg(container, 'test.svg');

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    const blob = createObjectURLSpy.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('image/svg+xml;charset=utf-8');
    expect(anchorClick).toHaveBeenCalled();
  });

  it('exportAsSvg uses default filename when none provided', () => {
    exportAsSvg(container);
    expect(anchorClick).toHaveBeenCalled();
  });

  it('does nothing when container has no SVG element', () => {
    const emptyContainer = document.createElement('div');
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL');

    exportAsSvg(emptyContainer);

    expect(createObjectURLSpy).not.toHaveBeenCalled();
    expect(anchorClick).not.toHaveBeenCalled();
  });

  it('serialized SVG blob type is correct', () => {
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL');
    exportAsSvg(container, 'valid.svg');

    const blob = createObjectURLSpy.mock.calls[0][0] as Blob;
    expect(blob.type).toContain('image/svg+xml');
  });

  it('appends and removes anchor element from body', () => {
    const appendChild = vi.spyOn(document.body, 'appendChild');
    const removeChild = vi.spyOn(document.body, 'removeChild');

    exportAsSvg(container, 'test.svg');

    expect(appendChild).toHaveBeenCalledTimes(1);
    expect(removeChild).toHaveBeenCalledTimes(1);
  });

  // Issue #1349: exported charts must resolve --chart-N custom properties
  // to literal colors, since the exported file has no :root stylesheet to
  // resolve var(--chart-N) against once opened outside this page.
  it('resolves CSS custom property colors to literal values in the exported SVG', async () => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('stroke', 'var(--chart-1)');
    container.querySelector('svg')!.appendChild(line);

    // jsdom's CSS engine doesn't resolve custom-property values from SVG
    // presentation attributes the way real browsers' getComputedStyle
    // does, so this stubs the one piece jsdom can't do -- everything else
    // (walking the original/clone trees, matching nodes, deciding which
    // attributes to replace) runs for real.
    const originalGetComputedStyle = window.getComputedStyle;
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => {
      const real = originalGetComputedStyle(el);
      if (el === line) {
        return new Proxy(real, {
          get(target, prop) {
            if (prop === 'getPropertyValue') {
              return (name: string) => (name === 'stroke' ? '#4af0b8' : target.getPropertyValue(name));
            }
            return Reflect.get(target, prop);
          },
        });
      }
      return real;
    });

    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL');

    exportAsSvg(container, 'test.svg');

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    const blob = createObjectURLSpy.mock.calls[0][0] as Blob;
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsText(blob);
    });
    expect(text).not.toContain('var(--chart-1)');
    expect(text).toContain('#4af0b8');
  });
});
