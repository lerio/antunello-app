import {
  Apple,
  ArrowRightLeft,
  BriefcaseBusiness,
  BriefcaseMedical,
  CarFront,
  CreditCard,
  Flower,
  Fuel,
  Gift,
  GraduationCap,
  House,
  Landmark,
  Plane,
  Popcorn,
  Receipt,
  Shield,
  ShoppingBag,
  SquareParking,
  Star,
  TrainFront,
  Utensils,
  Volleyball,
  Wrench,
} from "lucide-react";

export const CATEGORY_ICONS: Record<string, React.ComponentType> = {
  "Money Transfer": ArrowRightLeft,
  "Bank Movements": CreditCard,
  Dining: Utensils,
  Education: GraduationCap,
  Entertainment: Popcorn,
  Fitness: Volleyball,
  "Gifts and Donations": Gift,
  "Government Benefits": Landmark,
  Groceries: Apple,
  Health: BriefcaseMedical,
  Housing: House,
  Insurance: Shield,
  "Other Income": Star,
  "Personal Care": Flower,
  "Primary Income": BriefcaseBusiness,
  Services: Wrench,
  Shopping: ShoppingBag,
  "Taxes and Fines": Receipt,
  Transportation: TrainFront,
  Travel: Plane,
};

/**
 * Transportation is too broad for one icon: a fuel receipt is not a train.
 * The subcategory wins where it says something more specific.
 */
const SUBCATEGORY_ICONS: Record<string, React.ComponentType> = {
  Fuel,
  "Parking and Tolls": SquareParking,
  "Public Transportation": TrainFront,
  "Taxi and Car Sharing": CarFront,
  "Vehicles and Maintenance": Wrench,
};

/** The icon for a transaction row, preferring its subcategory. */
export function getTransactionIcon(
  category: string,
  subCategory?: string | null,
): React.ComponentType {
  return (
    (subCategory ? SUBCATEGORY_ICONS[subCategory] : undefined) ||
    CATEGORY_ICONS[category] ||
    CATEGORY_ICONS.Services
  );
}
