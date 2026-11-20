import {
  getBarAnimationProps,
  getLineAnimationProps,
  getAreaAnimationProps,
  getPieAnimationProps,
  getCartesianGridAnimationProps,
  getChartAnimations,
  shouldUseRechartsAnimations,
} from '../chartAnimation';

describe('chartAnimation utilities', () => {
  describe('getBarAnimationProps', () => {
    it('returns animation props when reducedMotion is false', () => {
      const props = getBarAnimationProps(false);
      expect(props).toEqual({
        isAnimationActive: true,
        animationBegin: 0,
        animationDuration: 400,
        animationEasing: 'ease-out',
      });
    });

    it('disables animation when reducedMotion is true', () => {
      const props = getBarAnimationProps(true);
      expect(props).toEqual({
        isAnimationActive: false,
      });
    });
  });

  describe('getLineAnimationProps', () => {
    it('returns animation props when reducedMotion is false', () => {
      const props = getLineAnimationProps(false);
      expect(props).toEqual({
        isAnimationActive: true,
        animationBegin: 0,
        animationDuration: 500,
        animationEasing: 'ease-out',
      });
    });

    it('disables animation when reducedMotion is true', () => {
      const props = getLineAnimationProps(true);
      expect(props).toEqual({
        isAnimationActive: false,
      });
    });
  });

  describe('getAreaAnimationProps', () => {
    it('returns animation props when reducedMotion is false', () => {
      const props = getAreaAnimationProps(false);
      expect(props).toEqual({
        isAnimationActive: true,
        animationBegin: 0,
        animationDuration: 500,
        animationEasing: 'ease-out',
      });
    });

    it('disables animation when reducedMotion is true', () => {
      const props = getAreaAnimationProps(true);
      expect(props).toEqual({
        isAnimationActive: false,
      });
    });
  });

  describe('getPieAnimationProps', () => {
    it('returns animation props when reducedMotion is false', () => {
      const props = getPieAnimationProps(false);
      expect(props).toEqual({
        isAnimationActive: true,
        animationBegin: 0,
        animationDuration: 600,
        animationEasing: 'ease-out',
      });
    });

    it('disables animation when reducedMotion is true', () => {
      const props = getPieAnimationProps(true);
      expect(props).toEqual({
        isAnimationActive: false,
      });
    });
  });

  describe('getCartesianGridAnimationProps', () => {
    it('returns animation props when reducedMotion is false', () => {
      const props = getCartesianGridAnimationProps(false);
      expect(props).toEqual({
        isAnimationActive: true,
        animationBegin: 100,
        animationDuration: 400,
        animationEasing: 'ease-out',
      });
    });

    it('disables animation when reducedMotion is true', () => {
      const props = getCartesianGridAnimationProps(true);
      expect(props).toEqual({
        isAnimationActive: false,
      });
    });
  });

  describe('getChartAnimations', () => {
    it('returns all animation props when reducedMotion is false', () => {
      const animations = getChartAnimations(false);
      expect(animations).toEqual({
        bar: {
          isAnimationActive: true,
          animationBegin: 0,
          animationDuration: 400,
          animationEasing: 'ease-out',
        },
        line: {
          isAnimationActive: true,
          animationBegin: 0,
          animationDuration: 500,
          animationEasing: 'ease-out',
        },
        area: {
          isAnimationActive: true,
          animationBegin: 0,
          animationDuration: 500,
          animationEasing: 'ease-out',
        },
        pie: {
          isAnimationActive: true,
          animationBegin: 0,
          animationDuration: 600,
          animationEasing: 'ease-out',
        },
        cartesianGrid: {
          isAnimationActive: true,
          animationBegin: 100,
          animationDuration: 400,
          animationEasing: 'ease-out',
        },
      });
    });

    it('disables all animations when reducedMotion is true', () => {
      const animations = getChartAnimations(true);
      expect(animations).toEqual({
        bar: { isAnimationActive: false },
        line: { isAnimationActive: false },
        area: { isAnimationActive: false },
        pie: { isAnimationActive: false },
        cartesianGrid: { isAnimationActive: false },
      });
    });
  });

  describe('shouldUseRechartsAnimations', () => {
    it('returns true when reducedMotion is false', () => {
      expect(shouldUseRechartsAnimations(false)).toBe(true);
    });

    it('returns false when reducedMotion is true', () => {
      expect(shouldUseRechartsAnimations(true)).toBe(false);
    });
  });
});