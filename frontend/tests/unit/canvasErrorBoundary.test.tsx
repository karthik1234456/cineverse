import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { CanvasErrorBoundary } from '../../components/3d/CanvasErrorBoundary';

describe('CanvasErrorBoundary', () => {
  it('catches thrown error via getDerivedStateFromError and transitions state', () => {
    const error = new Error('WebGL shader compile failure: simulated test error');
    const newState = CanvasErrorBoundary.getDerivedStateFromError(error);

    expect(newState.hasError).toBe(true);
    expect(newState.error).toBe(error);
  });

  it('logs caught errors to console.error in componentDidCatch', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const boundary = new CanvasErrorBoundary({ children: <div>Normal Content</div> });

    const error = new Error('Three.js context lost');
    const errorInfo = { componentStack: '\n    in FaultyThreeComponent' };

    boundary.componentDidCatch(error, errorInfo as any);

    expect(consoleSpy).toHaveBeenCalledWith(
      'CineVerse 3D Canvas Error Boundary caught an error:',
      error,
      errorInfo
    );

    consoleSpy.mockRestore();
  });

  it('renders children when no error has occurred', () => {
    const boundary = new CanvasErrorBoundary({
      children: <div id="test-child">Auditorium Active</div>,
    });
    boundary.state = { hasError: false, error: null };

    const rendered = boundary.render() as React.ReactElement;
    expect(rendered).toBeDefined();
    expect(rendered.props.id).toBe('test-child');
  });

  it('renders fallback UI with "Unable to load the 3D auditorium view" and "Back to seat map" button when error occurs', () => {
    const fallbackSpy = vi.fn();
    const boundary = new CanvasErrorBoundary({
      children: <div>Faulty Canvas</div>,
      onFallbackTo2D: fallbackSpy,
    });

    const error = new Error('ReferenceError: isMotionHall is not defined');
    boundary.state = { hasError: true, error };

    const rendered = boundary.render() as React.ReactElement;
    expect(rendered).toBeDefined();
    expect(rendered.props.role).toBe('alert');

    // Recursively search rendered tree for title and button
    const findInTree = (node: any, matcher: (el: any) => boolean): any => {
      if (!node) return null;
      if (matcher(node)) return node;
      if (node.props?.children) {
        const children = Array.isArray(node.props.children)
          ? node.props.children
          : [node.props.children];
        for (const child of children) {
          const found = findInTree(child, matcher);
          if (found) return found;
        }
      }
      return null;
    };

    // Assert title text
    const heading = findInTree(rendered, (el) => el.type === 'h2');
    expect(heading).toBeDefined();
    expect(heading.props.children).toBe('Unable to load the 3D auditorium view');

    // Assert "Back to seat map" button
    const button = findInTree(
      rendered,
      (el) => el.type === 'button' && el.props?.children === 'Back to seat map'
    );
    expect(button).toBeDefined();

    // Trigger button onClick and verify fallback callback is invoked
    button.props.onClick();
    expect(fallbackSpy).toHaveBeenCalledTimes(1);
  });
});

