import { 
  Home, HandCoins, Utensils, GraduationCap, Film, Dumbbell, Gift, 
  Briefcase, ShoppingCart, Heart, Shield, Coins, Scissors, 
  Building, Wrench, Receipt, Car, Plane
} from 'lucide-react'

export const CATEGORY_ICONS: Record<string, React.ComponentType> = {
  'Bank Movements': HandCoins,
  'Dining': Utensils,
  'Education': GraduationCap,
  'Entertainment': Film,
  'Fitness': Dumbbell,
  'Gifts and Donations': Gift,
  'Government Benefits': Briefcase,
  'Groceries': ShoppingCart,
  'Health': Heart,
  'Housing': Home,
  'Insurance': Shield,
  'Other Income': Coins,
  'Personal Care': Scissors,
  'Primary Income': Building,
  'Services': Wrench,
  'Shopping': ShoppingCart,
  'Taxes and Fines': Receipt,
  'Transportation': Car,
  'Travel': Plane,
} 