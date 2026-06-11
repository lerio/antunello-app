/**
 * Currency icon mapping utilities.
 *
 * Provides a function to map ISO 4217 currency codes to corresponding
 * Lucide React icon components, enabling visual currency indicators
 * throughout the application.
 *
 * @module utils/currency-icons
 */

import {
  BadgeEuro,
  BadgeJapaneseYen,
  BadgeDollarSign,
  BadgePoundSterling,
  BadgeCent,
  type LucideIcon,
} from "lucide-react";

/**
 * Returns the appropriate Lucide icon component for a given currency code.
 * Known currencies are mapped to specific icons; unknown currencies fall back
 * to a generic cent icon.
 *
 * @param currency - Three-letter ISO 4217 currency code (e.g. "EUR", "USD", "JPY", "GBP")
 * @returns A LucideIcon component for the currency
 */
export function getCurrencyIcon(currency: string): LucideIcon {
  switch (currency) {
    case "EUR":
      return BadgeEuro;
    case "JPY":
      return BadgeJapaneseYen;
    case "USD":
    case "CAD":
    case "AUD":
      return BadgeDollarSign;
    case "GBP":
      return BadgePoundSterling;
    default:
      return BadgeCent;
  }
}
