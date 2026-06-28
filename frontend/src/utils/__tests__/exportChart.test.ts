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
});
