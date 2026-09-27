import { createElement, Fragment, type CSSProperties, type ReactNode } from "react";
import { flatten, isRaw, type El } from "./node";
import type { Child } from "./node";

/** Attributi che React vuole con un nome diverso. */
const REACT_ATTR_ALIASES: Record<string, string> = {
  class: "className",
  for: "htmlFor",
  tabindex: "tabIndex",
  readonly: "readOnly",
  maxlength: "maxLength",
  minlength: "minLength",
  autocomplete: "autoComplete",
  autofocus: "autoFocus",
  colspan: "colSpan",
  rowspan: "rowSpan",
  srcset: "srcSet",
  "stroke-width": "strokeWidth",
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
  "stroke-dasharray": "strokeDasharray",
  "fill-rule": "fillRule",
  "clip-rule": "clipRule",
  "aria-hidden": "aria-hidden",
  focusable: "focusable",
};

function toReactAttrs(
  attrs: Record<string, string | number | boolean | null | undefined> | undefined,
): Record<string, unknown> | null {
  if (!attrs) return null;
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    const reactName = REACT_ATTR_ALIASES[name] ?? name;
    if (reactName === "style" && typeof value === "string") {
      out.style = parseStyleString(value);
      continue;
    }
    out[reactName] = value === true ? true : value;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Converte `"color:red;padding:4px"` nell'oggetto che React si aspetta. */
export function parseStyleString(value: string): CSSProperties {
  const style: Record<string, string> = {};
  for (const declaration of value.split(";")) {
    const index = declaration.indexOf(":");
    if (index === -1) continue;
    const key = declaration.slice(0, index).trim();
    const rawValue = declaration.slice(index + 1).trim();
    if (!key || !rawValue) continue;
    const camel = key.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
    style[camel] = rawValue;
  }
  return style as CSSProperties;
}

/**
 * Converte lo stesso albero usato per l'HTML in elementi React.
 * Le chiavi sono derivate dalla posizione nel percorso, così l'ordine resta stabile.
 */
export function renderReact(node: Child, key: string | number = 0): ReactNode {
  if (node === null || node === undefined || node === false) return null;
  if (typeof node === "string") return node;
  if (isRaw(node)) {
    return createElement("span", {
      key,
      style: { display: "contents" },
      dangerouslySetInnerHTML: { __html: node.raw },
    });
  }

  const element = node as El;
  const children = flatten(element.children ?? []);
  const props: Record<string, unknown> = {
    key,
    ...(toReactAttrs(element.attrs) ?? {}),
  };

  if (children.length === 0) return createElement(element.tag, props);
  const rendered = children.map((child, index) => renderReact(child, index));
  return createElement(element.tag, props, createElement(Fragment, null, rendered));
}
