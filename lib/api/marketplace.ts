import { supabase } from '../supabase';
import { MarketplaceItem, MarketplaceFilters, MarketplaceCategory } from '../../types/marketplace';

export const getMarketplaceCategories = async (): Promise<MarketplaceCategory[]> => {
  const { data, error } = await supabase
    .from('listing_categories')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching categories:', error);
    return [];
  }

  return data;
};

export const getCounties = async () => {
  const { data, error } = await supabase
    .from('counties')
    .select('*')
    .order('name');
  
  if (error) {
    console.error('Error fetching counties:', error);
    return [];
  }
  return data;
};

export const getMunicipalities = async (countyId?: string) => {
  let query = supabase
    .from('municipalities')
    .select('*')
    .order('name');
    
  if (countyId) {
    query = query.eq('county_id', countyId);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching municipalities:', error);
    return [];
  }
  return data;
};

export const getMarketplaceItems = async (organizationId: string, filters?: MarketplaceFilters): Promise<MarketplaceItem[]> => {
  let query = supabase
    .from('listings')
    .select(`
      *,
      category:listing_categories(*),
      listing_images(path, bucket)
    `)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (filters) {
    if (filters.category_id) {
      query = query.eq('category_id', filters.category_id);
    }
    if (filters.category_ids && filters.category_ids.length > 0) {
      query = query.in('category_id', filters.category_ids);
    }
    if (filters.transaction_type) {
      query = query.eq('transaction_type', filters.transaction_type);
    }
    if (filters.city) {
      query = query.ilike('city', `%${filters.city}%`);
    }
    if (filters.county_id) {
      query = query.eq('county_id', filters.county_id);
    }
    if (filters.municipality_id) {
      query = query.eq('municipality_id', filters.municipality_id);
    }
    if (filters.minPrice !== undefined) {
      query = query.gte('price', filters.minPrice);
    }
    if (filters.maxPrice !== undefined) {
      query = query.lte('price', filters.maxPrice);
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching marketplace items:', error);
    throw error;
  }

  return data as MarketplaceItem[];
};

export const getUserMarketplaceItems = async (organizationId: string, userId: string): Promise<MarketplaceItem[]> => {
  const { data, error } = await supabase
    .from('listings')
    .select(`
      *,
      category:listing_categories(*),
      listing_images(path, bucket)
    `)
    .eq('organization_id', organizationId)
    .eq('created_by', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching user items:', error);
    throw error;
  }

  return data as MarketplaceItem[];
};
