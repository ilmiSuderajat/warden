import { redirect } from 'next/navigation';

export default function CategoryRedirect({ params }: { params: { id: string } }) {
  redirect(`/category?id=${params.id}`);
}