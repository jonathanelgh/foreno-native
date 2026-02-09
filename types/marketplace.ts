export interface MarketplaceCategory {
  id: string;
  name: string;
  icon: string | null;
  sort_order: number;
  parent_id: string | null;
}

export interface MarketplaceItem {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  city: string | null;
  category_id: string;
  category?: MarketplaceCategory;
  created_at: string;
  created_by: string;
  organization_id: string;
  transaction_type: 'buy' | 'sell' | 'give';
  images?: { path: string; bucket: string }[];
  listing_images?: { path: string; bucket: string }[]; // For join query
}

export interface MarketplaceFilters {
  category_id?: string;
  category_ids?: string[]; // Support multiple categories (for parent/child filtering)
  minPrice?: number;
  maxPrice?: number;
  city?: string;
  county_id?: string;
  municipality_id?: string;
  transaction_type?: 'buy' | 'sell' | 'give';
}
