// GSAP 动效工具 —— 克制、只做"出现"与"切换"两类动效

import { useEffect } from 'react';
import gsap from 'gsap';

/** 首屏标题三行上浮 + 元素淡入 */
export function usePageReveal(deps: unknown[] = []) {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      document.querySelectorAll('.hero h1 .line').forEach(el => el.classList.add('is-in'));
      gsap.set('.reveal, .reveal-stagger > *', { opacity: 1, y: 0 });
      return;
    }

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    // 标题三行：先加类触发 CSS 过渡
    requestAnimationFrame(() => {
      document.querySelectorAll('.hero h1 .line').forEach(el => el.classList.add('is-in'));
    });

    tl.fromTo('.reveal',
      { opacity: 0, y: 22 },
      { opacity: 1, y: 0, duration: .7, stagger: .12, delay: .1 });

    tl.fromTo('.reveal-stagger > *',
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: .55, stagger: .06 }, '-=.5');

    return () => { tl.kill(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** 一组卡片/行错峰入场（用于师承谱、岗位列表、社区流） */
export function useStaggerIn(selector: string, deps: unknown[] = []) {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const els = document.querySelectorAll(selector);
    if (!els.length) return;
    const tween = gsap.fromTo(els,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: .46, stagger: .035, ease: 'power2.out', overwrite: true });
    return () => { tween.kill(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** 面板滑入（右栏详情 / 抽屉） */
export function slideInX(el: HTMLElement | null, from = 24) {
  if (!el) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  gsap.fromTo(el, { opacity: 0, x: from }, { opacity: 1, x: 0, duration: .38, ease: 'power2.out', overwrite: true });
}

/** 切换家派时的中栏内容淡入 */
export function swapFade(el: HTMLElement | null) {
  if (!el) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  gsap.fromTo(el, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .34, ease: 'power2.out', overwrite: true });
}
