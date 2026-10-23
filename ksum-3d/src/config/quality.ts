/**
 * `?lite` in the URL drops the tree layer and shadows and renders only on change.
 * Headless screenshots run on software WebGL, where the full scene takes minutes
 * per frame and continuous rendering starves the page's other work.
 */
export const LITE = typeof location !== 'undefined' && new URLSearchParams(location.search).has('lite')
