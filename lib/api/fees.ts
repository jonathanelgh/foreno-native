import { supabase } from '../supabase';
import { Database } from '../../types/database';

export type Fee = Database['public']['Tables']['fees']['Row'];
export type FeeAssignment = Database['public']['Tables']['fee_assignments']['Row'];
export type FeePayment = Database['public']['Tables']['fee_payments']['Row'];

export type FeeWithPayment = Fee & {
  payment: FeePayment | null;
  assignment_id: string;
};

export async function getUserFees(organizationId: string, userId: string): Promise<FeeWithPayment[]> {
  // 1. Get the user's membership for this organization
  const { data: membership, error: membershipError } = await supabase
    .from('memberships')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .single();

  if (membershipError || !membership) {
    console.error('Error fetching membership for fees:', membershipError);
    return [];
  }

  // 2. Get fees directly linked to this membership OR applying to all
  // We rely on RLS to filter fees that the user is allowed to see.
  // We typically just want to see fees for this organization.
  const { data: feesData, error: feesError } = await supabase
    .from('fees')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (feesError) {
    console.error('Error fetching fees:', feesError);
    return [];
  }

  if (!feesData || feesData.length === 0) {
    return [];
  }

  // 3. Map to FeeWithPayment structure
  // We use the fee's own columns for payment status info
  return feesData.map(fee => {
    // Construct a "payment" object from the fee's own fields to match the interface
    // or we could update the interface to rely on fee fields directly.
    // For now, let's populate the payment object so the UI keeps working.
    const payment = {
      id: fee.id, // Use fee id as payment id proxy
      fee_id: fee.id,
      membership_id: fee.membership_id,
      status: fee.payment_status || 'unpaid',
      due_date: fee.due_date,
      paid_date: fee.paid_date,
      notes: null,
      invoice_pdf_bucket: fee.invoice_pdf_bucket,
      invoice_pdf_path: fee.invoice_pdf_path,
      invoice_pdf_file_name: fee.invoice_pdf_file_name,
      email_sent_at: fee.email_sent_at,
      created_at: fee.created_at,
    } as FeePayment;

    return {
      ...fee,
      assignment_id: 'direct', 
      payment: payment,
    };
  });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getStatusColor(status: string | undefined, dueDate: string | null): string {
  if (status === 'paid') return '#10b981'; // green-500
  
  // Check if overdue (explicitly or by date)
  if (status === 'overdue' || (dueDate && new Date(dueDate) < new Date())) {
    return '#ef4444'; // red-500
  }
  
  // Default/unpaid
  return '#f59e0b'; // amber-500
}

export function getStatusText(status: string | undefined, dueDate: string | null): string {
  if (status === 'paid') return 'Betald';
  
  if (status === 'overdue' || (dueDate && new Date(dueDate) < new Date())) {
    return 'Försenad';
  }
  
  return 'Obetald';
}
