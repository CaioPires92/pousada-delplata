import { redirect } from 'next/navigation';

export default function LegacyDiscountPolicyPage() {
    redirect('/admin/cupons');
}
