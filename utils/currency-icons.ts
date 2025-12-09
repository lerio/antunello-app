import {
  BadgeEuro,
  BadgeJapaneseYen,
  BadgeDollarSign,
  BadgePoundSterling,
  BadgeCent,
  type LucideIcon,
} from "lucide-react";

/**
 * Returns the appropriate Lucide icon component for a currency.
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
