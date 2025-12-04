import {
  Building2,
  Utensils,
  GraduationCap,
  Gamepad2,
  Dumbbell,
  Gift,
  Landmark,
  ShoppingCart,
  Heart,
  Home,
  Shield,
  DollarSign,
  Sparkles,
  Briefcase,
  Wrench,
  ShoppingBag,
  Receipt,
  Car,
  Plane,
  ArrowRightLeft,
  LucideIcon
} from 'lucide-react'

// Category icon mapping
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'Money Transfer': ArrowRightLeft,
  'Bank Movements': Building2,
  'Dining': Utensils,
  'Education': GraduationCap,
  'Entertainment': Gamepad2,
  'Fitness': Dumbbell,
  'Gifts and Donations': Gift,
  'Government Benefits': Landmark,
  'Groceries': ShoppingCart,
  'Health': Heart,
  'Housing': Home,
  'Insurance': Shield,
  'Other Income': DollarSign,
  'Personal Care': Sparkles,
  'Primary Income': Briefcase,
  'Services': Wrench,
  'Shopping': ShoppingBag,
  'Taxes and Fines': Receipt,
  'Transportation': Car,
  'Travel': Plane,
}

export const getCategoryIcon = (category: string): LucideIcon | null => {
  return CATEGORY_ICONS[category] || null
}