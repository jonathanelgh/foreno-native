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

export type ListingDetail = MarketplaceItem & {
  creator?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    profile_image_url: string | null;
  } | null;
  signed_image_urls?: string[];
};

export const getListingById = async (listingId: string): Promise<ListingDetail | null> => {
  const { data, error } = await supabase
    .from('listings')
    .select(`
      *,
      category:listing_categories(*),
      listing_images(path, bucket)
    `)
    .eq('id', listingId)
    .maybeSingle();

  if (error || !data) {
    console.error('Error fetching listing:', error);
    return null;
  }

  const listing = data as MarketplaceItem;

  // Sign image URLs
  const images = listing.listing_images || [];
  const signedUrls: string[] = [];
  for (const img of images) {
    try {
      const { data: urlData } = await supabase.storage
        .from(img.bucket || 'listing_images')
        .createSignedUrl(img.path, 3600);
      if (urlData?.signedUrl) signedUrls.push(urlData.signedUrl);
    } catch {
      // skip failed images
    }
  }

  // Fetch creator profile
  let creator: ListingDetail['creator'] = null;
  if (listing.created_by) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, first_name, last_name, profile_image_url')
      .eq('id', listing.created_by)
      .maybeSingle();
    if (profile) {
      creator = {
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        profile_image_url: profile.profile_image_url,
      };
    }
  }

  return { ...listing, creator, signed_image_urls: signedUrls };
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
