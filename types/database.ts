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

export const SUB_CATEGORIES: Record<(typeof MAIN_CATEGORIES)[number], string[]> = {
  'Bank Movements': ['Initial Assets'],
  Dining: ['Restaurants', 'Bar and Drinks', 'Food Delivery'],
  Education: ['Tuition and Fees', 'Books and Supplies', 'Educational Services'],
  Entertainment: ['Media Subscriptions', 'Movies and Theaters', 'Museums and Events'],
  Fitness: ['Sport Memberships', 'Sport Equipment', 'Other Activities'],
  'Gifts and Donations': ['Gifts', 'Donations to Causes', 'Charity', 'Loan'],
  'Government Benefits': ['Unemployment Benefits', 'Welfare', 'Child Support'],
  Groceries: ['Supermarket', 'Drugstore'],
  Health: ['Health Insurance', 'Medical Bills', 'Pharmacy'],
  Housing: ['Rent', 'Utilities', 'Home Maintenance', 'Furniture and Houseware'],
  Insurance: ['Car Insurance', 'Home Insurance', 'Travel Insurance', 'Other Insurance'],
  'Other Income': ['Reimbursements', 'Gifts and Inheritance', 'Miscellaneous Income', 'Second-Hand Sales'],
  'Personal Care': ['Haircuts and Beauty', 'Spa and Treatments'],
  'Primary Income': ['Salary', 'Investment Income'],
  Services: ['Postal Office', 'Office', 'Stationery', 'Other Services', 'Bank Fees', 'Digital Services'],
  Shopping: ['Clothing and Accessories', 'Toys and Videogames', 'Tech and Gadgets', 'Books and Comics'],
  'Taxes and Fines': ['Income Taxes', 'Property Taxes', 'Fines'],
  Transportation: ['Fuel', 'Public Transportation', 'Vehicles and Maintenance', 'Parking and Tolls', 'Taxi and Car Sharing'],
  Travel: ['Accommodations', 'Flights', 'Trains and Buses', 'Travel Fees']
} 