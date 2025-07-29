export type Transaction = {
  id: string
  user_id: string
  amount: number
  currency: string
  type: 'expense' | 'income'
  main_category: string
  sub_category?: string
  title: string
  date: string
  created_at: string
  updated_at: string
  // Currency conversion fields
  eur_amount?: number
  exchange_rate?: number
  rate_date?: string
}

export type ExchangeRate = {
  id: string
  date: string
  base_currency: string
  target_currency: string
  rate: number
  source: string
  created_at: string
  updated_at: string
  is_missing?: boolean
}

export const MAIN_CATEGORIES = [
  'Bank Movements',
  'Dining',
  'Education',
  'Entertainment',
  'Fitness',
  'Gifts and Donations',
  'Government Benefits',
  'Groceries',
  'Health',
  'Housing',
  'Insurance',
  'Other Income',
  'Personal Care',
  'Primary Income',
  'Services',
  'Shopping',
  'Taxes and Fines',
  'Transportation',
  'Travel',
] as const

export const CATEGORIES_WITH_TYPES = [
  {
    "category": "Bank Movements",
    "subcategories": [
      "Initial Assets"
    ],
    "type": "income"
  },
  {
    "category": "Dining",
    "subcategories": [
      "Bars and Drinks",
      "Food Delivery",
      "Restaurants"
    ],
    "type": "expense"
  },
  {
    "category": "Education",
    "subcategories": [
      "Books and Supplies",
      "Educational Services",
      "Tuition and Fees"
    ],
    "type": "expense"
  },
  {
    "category": "Entertainment",
    "subcategories": [
      "Media Subscriptions",
      "Movies and Theaters",
      "Museums and Events"
    ],
    "type": "expense"
  },
  {
    "category": "Fitness",
    "subcategories": [
      "Other Activities",
      "Sport Equipment",
      "Sport Memberships"
    ],
    "type": "expense"
  },
  {
    "category": "Gifts and Donations",
    "subcategories": [
      "Charity",
      "Donations to Causes",
      "Gifts",
      "Loan"
    ],
    "type": "expense"
  },
  {
    "category": "Government Benefits",
    "subcategories": [
      "Child Support",
      "Unemployment Benefits",
      "Welfare"
    ],
    "type": "income"
  },
  {
    "category": "Groceries",
    "subcategories": [
      "Drugstore",
      "Supermarket"
    ],
    "type": "expense"
  },
  {
    "category": "Health",
    "subcategories": [
      "Health Insurance",
      "Medical Bills",
      "Pharmacy"
    ],
    "type": "expense"
  },
  {
    "category": "Housing",
    "subcategories": [
      "Furniture and Houseware",
      "Home Maintenance",
      "Rent",
      "Utilities"
    ],
    "type": "expense"
  },
  {
    "category": "Insurance",
    "subcategories": [
      "Car Insurance",
      "Home Insurance",
      "Other Insurance",
      "Travel Insurance"
    ],
    "type": "expense"
  },
  {
    "category": "Other Income",
    "subcategories": [
      "Gifts and Inheritance",
      "Miscellaneous Income",
      "Reimbursements",
      "Second-Hand Sales"
    ],
    "type": "income"
  },
  {
    "category": "Personal Care",
    "subcategories": [
      "Haircuts and Beauty",
      "Spa and Treatments"
    ],
    "type": "expense"
  },
  {
    "category": "Primary Income",
    "subcategories": [
      "Investment Income",
      "Salary"
    ],
    "type": "income"
  },
  {
    "category": "Services",
    "subcategories": [
      "Bank Fees",
      "Digital Services",
      "Office",
      "Other Services",
      "Postal Office",
      "Stationery"
    ],
    "type": "expense"
  },
  {
    "category": "Shopping",
    "subcategories": [
      "Books and Comics",
      "Clothing and Accessories",
      "Tech and Gadgets",
      "Toys and Videogames"
    ],
    "type": "expense"
  },
  {
    "category": "Taxes and Fines",
    "subcategories": [
      "Fines",
      "Income Taxes",
      "Investment Losses",
      "Property Taxes"
    ],
    "type": "expense"
  },
  {
    "category": "Transportation",
    "subcategories": [
      "Fuel",
      "Parking and Tolls",
      "Public Transportation",
      "Taxi and Car Sharing",
      "Vehicles and Maintenance"
    ],
    "type": "expense"
  },
  {
    "category": "Travel",
    "subcategories": [
      "Accommodations",
      "Flights",
      "Trains and Buses",
      "Travel Fees"
    ],
    "type": "expense"
  }
] as const

export const SUB_CATEGORIES: Record<(typeof MAIN_CATEGORIES)[number], string[]> = {
  'Bank Movements': ['Initial Assets'],
  Dining: ['Bars and Drinks', 'Food Delivery', 'Restaurants'],
  Education: ['Books and Supplies', 'Educational Services', 'Tuition and Fees'],
  Entertainment: ['Media Subscriptions', 'Movies and Theaters', 'Museums and Events'],
  Fitness: ['Other Activities', 'Sport Equipment', 'Sport Memberships'],
  'Gifts and Donations': ['Charity', 'Donations to Causes', 'Gifts', 'Loan'],
  'Government Benefits': ['Child Support', 'Unemployment Benefits', 'Welfare'],
  Groceries: ['Drugstore', 'Supermarket'],
  Health: ['Health Insurance', 'Medical Bills', 'Pharmacy'],
  Housing: ['Furniture and Houseware', 'Home Maintenance', 'Rent', 'Utilities'],
  Insurance: ['Car Insurance', 'Home Insurance', 'Other Insurance', 'Travel Insurance'],
  'Other Income': ['Gifts and Inheritance', 'Miscellaneous Income', 'Reimbursements', 'Second-Hand Sales'],
  'Personal Care': ['Haircuts and Beauty', 'Spa and Treatments'],
  'Primary Income': ['Investment Income', 'Salary'],
  Services: ['Bank Fees', 'Digital Services', 'Office', 'Other Services', 'Postal Office', 'Stationery'],
  Shopping: ['Books and Comics', 'Clothing and Accessories', 'Tech and Gadgets', 'Toys and Videogames'],
  'Taxes and Fines': ['Fines', 'Income Taxes', 'Investment Losses', 'Property Taxes'],
  Transportation: ['Fuel', 'Parking and Tolls', 'Public Transportation', 'Taxi and Car Sharing', 'Vehicles and Maintenance'],
  Travel: ['Accommodations', 'Flights', 'Trains and Buses', 'Travel Fees']
}

// Helper function to get category type
export function getCategoryType(category: string): 'income' | 'expense' {
  const categoryData = CATEGORIES_WITH_TYPES.find(cat => cat.category === category);
  return categoryData?.type || 'expense';
} 