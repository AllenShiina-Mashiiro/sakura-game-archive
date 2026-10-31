import { redirect } from 'next/navigation';
export default function AdminSectionRedirect() {
  redirect('/admin?section=reviews');
}
