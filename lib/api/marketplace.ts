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
      const { data: urlData, error: signError } = await supabase.storage
        .from(img.bucket || 'listing_images')
        .createSignedUrl(img.path, 3600);
      if (signError) {
        console.error('Error signing image URL:', signError, 'path:', img.path, 'bucket:', img.bucket);
      }
      if (urlData?.signedUrl) signedUrls.push(urlData.signedUrl);
    } catch (e) {
      console.error('Exception signing image URL:', e);
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

export const createListing = async (params: {
  organizationId: string;
  categoryId: string;
  title: string;
  description: string | null;
  transactionType: 'sell' | 'buy' | 'give';
  price: number | null;
  countyId: string;
  municipalityId: string;
  city: string | null;
  userId: string;
}): Promise<string> => {
  const { data, error } = await supabase
    .from('listings')
    .insert({
      organization_id: params.organizationId,
      category_id: params.categoryId,
      title: params.title.trim(),
      description: params.description?.trim() || null,
      transaction_type: params.transactionType,
      price: params.transactionType === 'give' ? 0 : params.price,
      county_id: params.countyId,
      municipality_id: params.municipalityId,
      city: params.city,
      created_by: params.userId,
      expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating listing:', error);
    throw error;
  }

  return data.id;
};

export const uploadListingImage = async (params: {
  organizationId: string;
  listingId: string;
  imageUri: string;
  sortOrder: number;
}): Promise<void> => {
  const { decode } = await import('base64-arraybuffer');
  const FileSystem = await import('expo-file-system/legacy');

  const fileExt = params.imageUri.split('.').pop()?.toLowerCase() || 'jpg';
  const mimeType = `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${fileExt}`;
  const filePath = `${params.organizationId}/${params.listingId}/${fileName}`;

  const base64 = await FileSystem.readAsStringAsync(params.imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const { error: uploadError } = await supabase.storage
    .from('listing_images')
    .upload(filePath, decode(base64), {
      contentType: mimeType,
    });

  if (uploadError) {
    console.error('Error uploading listing image:', uploadError);
    throw uploadError;
  }

  const { error: insertError } = await supabase
    .from('listing_images')
    .insert({
      listing_id: params.listingId,
      bucket: 'listing_images',
      path: filePath,
      sort_order: params.sortOrder,
    });

  if (insertError) {
    console.error('Error inserting listing image record:', insertError);
    throw insertError;
  }
};

export const getUserMarketplaceItems = async (organizationId: string, userId: string): Promise<MarketplaceItem[]> => {
  const { data, error } = await supabase
    .from('listings')
    .select(`
      *,
      category:listing_categories(*),
      listing_images(path, bucket, sort_order)
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

export const updateListing = async (listingId: string, updates: {
  title?: string;
  description?: string | null;
  price?: number | null;
  transaction_type?: 'sell' | 'buy' | 'give';
  status?: string;
  category_id?: string;
  county_id?: string;
  municipality_id?: string;
  city?: string | null;
}): Promise<void> => {
  const { error } = await supabase
    .from('listings')
    .update(updates)
    .eq('id', listingId);

  if (error) {
    console.error('Error updating listing:', error);
    throw error;
  }
};

export const updateListingStatus = async (listingId: string, status: string): Promise<void> => {
  const { error } = await supabase
    .from('listings')
    .update({ status })
    .eq('id', listingId);

  if (error) {
    console.error('Error updating listing status:', error);
    throw error;
  }
};

export const deleteListing = async (listingId: string): Promise<void> => {
  // First delete listing images records
  const { error: imgError } = await supabase
    .from('listing_images')
    .delete()
    .eq('listing_id', listingId);

  if (imgError) {
    console.error('Error deleting listing images:', imgError);
  }

  // Then delete the listing
  const { error } = await supabase
    .from('listings')
    .delete()
    .eq('id', listingId);

  if (error) {
    console.error('Error deleting listing:', error);
    throw error;
  }
};

export const deleteListingImage = async (imageId: string, bucket: string, path: string): Promise<void> => {
  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from(bucket)
    .remove([path]);

  if (storageError) {
    console.error('Error deleting image from storage:', storageError);
  }

  // Delete from DB
  const { error } = await supabase
    .from('listing_images')
    .delete()
    .eq('id', imageId);

  if (error) {
    console.error('Error deleting listing image record:', error);
    throw error;
  }
};
