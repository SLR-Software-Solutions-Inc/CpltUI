// Motion primitives — durations + svelte transition wrappers.
// Aurora mock: native CSS `ease` keyword everywhere. No custom cubic-bezier.

import { fade, fly, scale, type FadeParams, type FlyParams, type ScaleParams } from 'svelte/transition';
import { cubicOut } from 'svelte/easing';

export const DURATION = {
  hover: 120,
  toggle: 150,
  modal: 200,
  panel: 220,
} as const;

export function modalFade(_node: Element, params?: FadeParams) {
  return fade(_node, { duration: DURATION.modal, ...params });
}

export function panelSlide(_node: Element, params?: FlyParams) {
  return fly(_node, { x: 24, duration: DURATION.panel, easing: cubicOut, ...params });
}

export function dropdownPop(_node: Element, params?: ScaleParams) {
  return scale(_node, {
    duration: DURATION.toggle,
    start: 0.96,
    opacity: 0,
    easing: cubicOut,
    ...params,
  });
}
