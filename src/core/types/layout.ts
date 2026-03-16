/**
 * Layout types for composite UI arrangement.
 *
 * @module types/layout
 */

/**
 * Layout modes for composite UI arrangement.
 *
 * - `"split"` — Side-by-side panels (e.g., query + visualization)
 * - `"tabs"` — Tabbed interface for mutually exclusive views
 * - `"grid"` — Grid layout for dashboard-style arrangements
 * - `"stack"` — Vertical stack for sequential content
 *
 * @example
 * ```typescript
 * const layout: UiLayout = "split";
 * ```
 */
export type UiLayout = "split" | "tabs" | "grid" | "stack";

/**
 * All valid layout values for runtime validation.
 *
 * @example
 * ```typescript
 * UI_LAYOUTS.forEach(layout => console.log(layout));
 * // "split", "tabs", "grid", "stack"
 * ```
 */
export const UI_LAYOUTS: readonly UiLayout[] = ["split", "tabs", "grid", "stack"] as const;

/**
 * Check if a string is a valid UiLayout.
 *
 * @example
 * ```typescript
 * isValidLayout("split"); // true
 * isValidLayout("unknown"); // false
 * ```
 */
export function isValidLayout(value: string): value is UiLayout {
  return UI_LAYOUTS.includes(value as UiLayout);
}
