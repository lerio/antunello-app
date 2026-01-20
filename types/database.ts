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
  // Hide from monthly totals
  hide_from_totals?: boolean
  // Link to fund category
  fund_category_id?: string | null
  // Money transfer fields
  is_money_transfer?: boolean
  target_fund_category_id?: string | null
}

export type Budget = {
  id: string
  user_id: string
  category: string
  amount: number
  created_at: string
  updated_at: string
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

export type FundCategory = {
  id: string
  user_id: string
  name: string
  description?: string
  currency: string
  amount: number
  is_active: boolean
  order_index: number
  top_level_category?: string
  created_at: string
  updated_at: string
}

// Define the type
type CategoryData = {
  category: string;
  subcategories: ReadonlyArray<string>;
  type: 'income' | 'expense';
};

// Use a smaller inline constant for now to avoid webpack cache issues
export const CATEGORIES_WITH_TYPES: ReadonlyArray<CategoryData> = [
  { category: "Money Transfer", subcategories: ["Money Transfer"], type: "expense" },
  { category: "Bank Movements", subcategories: ["Initial Assets"], type: "income" },
  { category: "Dining", subcategories: ["Bars and Drinks", "Food Delivery", "Restaurants"], type: "expense" },
  { category: "Education", subcategories: ["Books and Supplies", "Educational Services", "Tuition and Fees"], type: "expense" },
  { category: "Entertainment", subcategories: ["Media Subscriptions", "Movies and Theaters", "Museums and Events"], type: "expense" },
  { category: "Fitness", subcategories: ["Other Activities", "Sport Equipment", "Sport Memberships"], type: "expense" },
  { category: "Gifts and Donations", subcategories: ["Charity", "Donations to Causes", "Gifts", "Loan"], type: "expense" },
  { category: "Government Benefits", subcategories: ["Child Support", "Unemployment Benefits", "Welfare"], type: "income" },
  { category: "Groceries", subcategories: ["Drugstore", "Supermarket"], type: "expense" },
  { category: "Health", subcategories: ["Health Insurance", "Medical Bills", "Pharmacy"], type: "expense" },
  { category: "Housing", subcategories: ["Furniture and Houseware", "Home Maintenance", "Rent", "Utilities"], type: "expense" },
  { category: "Insurance", subcategories: ["Car Insurance", "Home Insurance", "Other Insurance", "Travel Insurance"], type: "expense" },
  { category: "Other Income", subcategories: ["Gifts and Inheritance", "Miscellaneous Income", "Reimbursements", "Second-Hand Sales"], type: "income" },
  { category: "Personal Care", subcategories: ["Haircuts and Beauty", "Spa and Treatments"], type: "expense" },
  { category: "Primary Income", subcategories: ["Investment Income", "Salary"], type: "income" },
  { category: "Services", subcategories: ["Bank Fees", "Digital Services", "Office", "Other Services", "Postal Office", "Stationery"], type: "expense" },
  { category: "Shopping", subcategories: ["Books and Comics", "Clothing and Accessories", "Tech and Gadgets", "Toys and Videogames"], type: "expense" },
  { category: "Taxes and Fines", subcategories: ["Fines", "Income Taxes", "Investment Losses", "Property Taxes"], type: "expense" },
  { category: "Transportation", subcategories: ["Fuel", "Parking and Tolls", "Public Transportation", "Taxi and Car Sharing", "Vehicles and Maintenance"], type: "expense" },
  { category: "Travel", subcategories: ["Accommodations", "Flights", "Trains and Buses", "Travel Fees"], type: "expense" }
]

// Derived arrays from CATEGORIES_WITH_TYPES
export const MAIN_CATEGORIES = CATEGORIES_WITH_TYPES.map(cat => cat.category)

export const SUB_CATEGORIES: Record<string, string[]> = CATEGORIES_WITH_TYPES.reduce(
  (acc, cat) => ({ ...acc, [cat.category]: cat.subcategories }),
  {}
)

// Helper function to get category type
export function getCategoryType(category: string): 'income' | 'expense' {
  const categoryData = CATEGORIES_WITH_TYPES.find(cat => cat.category === category);
  return categoryData?.type || 'expense';
}

// Top-level fund categories
export const TOP_LEVEL_FUND_CATEGORIES = [
  "Checking Accounts",
  "Savings Accounts",
  "Investments",
  "P2P Lending",
  "Financial Services",
  "Cash"
] as const;

// Title suggestion types
export type TitleSuggestion = {
  id: string
  user_id: string
  title: string
  type: 'expense' | 'income'
  main_category: string
  sub_category?: string
  frequency: number
  last_used_at: string
  created_at: string
  updated_at: string
}

export type TitleSuggestionInput = Omit<TitleSuggestion, 'id' | 'user_id' | 'created_at' | 'updated_at'> 