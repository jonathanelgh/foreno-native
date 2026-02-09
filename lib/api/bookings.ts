import { supabase } from '../supabase';
import { Database } from '../../types/database';

export type BookingProduct = Database['public']['Tables']['booking_products']['Row'];
export type BookingProductDuration = Database['public']['Tables']['booking_product_durations']['Row'];
export type BookingProductAvailability = Database['public']['Tables']['booking_product_availability']['Row'];
export type Booking = Database['public']['Tables']['bookings']['Row'];

export type BookingProductWithDetails = BookingProduct & {
  durations: BookingProductDuration[];
  availability: BookingProductAvailability[];
};

export async function getBookingProducts(organizationId: string): Promise<BookingProductWithDetails[]> {
  // 1. Get products
  const { data: products, error: productsError } = await supabase
    .from('booking_products')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('name');

  if (productsError) {
    console.error('Error fetching booking products:', productsError);
    return [];
  }

  if (!products || products.length === 0) {
    return [];
  }

  const productIds = products.map(p => p.id);

  // 2. Get durations
  const { data: durations, error: durationsError } = await supabase
    .from('booking_product_durations')
    .select('*')
    .in('product_id', productIds)
    .eq('is_active', true)
    .order('sort_order')
    .order('minutes');

  if (durationsError) {
    console.error('Error fetching durations:', durationsError);
  }

  // 3. Get availability
  const { data: availability, error: availabilityError } = await supabase
    .from('booking_product_availability')
    .select('*')
    .in('product_id', productIds)
    .eq('is_active', true);

  if (availabilityError) {
    console.error('Error fetching availability:', availabilityError);
  }

  // 4. Combine
  const durationsMap = new Map<string, BookingProductDuration[]>();
  durations?.forEach(d => {
    if (!durationsMap.has(d.product_id)) {
      durationsMap.set(d.product_id, []);
    }
    durationsMap.get(d.product_id)?.push(d);
  });

  const availabilityMap = new Map<string, BookingProductAvailability[]>();
  availability?.forEach(a => {
    if (!availabilityMap.has(a.product_id)) {
      availabilityMap.set(a.product_id, []);
    }
    availabilityMap.get(a.product_id)?.push(a);
  });

  return products.map(product => ({
    ...product,
    durations: durationsMap.get(product.id) || [],
    availability: availabilityMap.get(product.id) || [],
  }));
}

export async function getBookingsForProduct(
  productId: string,
  start: Date,
  end: Date
): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('product_id', productId)
    .neq('status', 'cancelled')
    .lt('start_at', end.toISOString())
    .gt('end_at', start.toISOString());

  if (error) {
    console.error('Error fetching bookings for product:', error);
    throw error;
  }

  return data || [];
}

export async function createBooking(
  productId: string,
  membershipId: string,
  startAt: Date,
  endAt: Date,
  createdBy: string,
  notes?: string
): Promise<Booking | null> {
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      product_id: productId,
      membership_id: membershipId,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      created_by: createdBy,
      notes: notes,
      status: 'confirmed'
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating booking:', error);
    throw error;
  }

  return data;
}

export type BookingWithProduct = Booking & {
  booking_products: BookingProduct | null;
};

export async function getUserBookings(
  organizationId: string,
  userId: string
): Promise<BookingWithProduct[]> {
  // 1. Get user's membership
  const { data: membership, error: membershipError } = await supabase
    .from('memberships')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .single();

  if (membershipError || !membership) {
    console.error('Error fetching membership for bookings:', membershipError);
    return [];
  }

  // 2. Get bookings
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      booking_products (*)
    `)
    .eq('membership_id', membership.id)
    .order('start_at', { ascending: true });

  if (error) {
    console.error('Error fetching user bookings:', error);
    return [];
  }

  const allBookings = (data || []) as BookingWithProduct[];
  const now = new Date();

  // Sort: Upcoming (nearest first), then Past (most recent first)
  const upcoming = allBookings.filter(b => new Date(b.end_at) >= now);
  const past = allBookings.filter(b => new Date(b.end_at) < now);

  // Upcoming are already sorted ASC by query
  // Past are sorted ASC by query, but we want DESC (most recent past first)
  return [...upcoming, ...past.reverse()];
}

export async function cancelBooking(bookingId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('bookings')
    .update({ 
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: userId
    })
    .eq('id', bookingId);

  if (error) {
    console.error('Error cancelling booking:', error);
    throw error;
  }
}
