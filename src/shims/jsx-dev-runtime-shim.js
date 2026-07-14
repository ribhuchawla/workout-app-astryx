// Workaround for @astryxdesign/core v0.1.5 bug: several components
// (Token, Tooltip, SideNav, Pagination, etc.) import `jsxDEV` from
// 'react/jsx-dev-runtime' in their published dist output. That entry point
// is meant for local development only and is not meant to ship in a
// production bundle — production React's real jsx-runtime only exports
// `jsx` / `jsxs` / `Fragment`, not `jsxDEV`, which is what causes the
// "(0 , N.jsxDEV) is not a function" crash in production.
//
// This shim re-implements jsxDEV in terms of the real prod `jsx` function
// (dropping the extra dev-only debug args), so aliasing
// 'react/jsx-dev-runtime' -> this file in vite.config.ts fixes it without
// needing to patch node_modules.
import { jsx, jsxs, Fragment } from 'react/jsx-runtime';

export { Fragment };

export function jsxDEV(type, props, key, _isStaticChildren, _source, _self) {
  return jsx(type, props, key);
}

export function jsxsDEV(type, props, key, _isStaticChildren, _source, _self) {
  return jsxs(type, props, key);
}
