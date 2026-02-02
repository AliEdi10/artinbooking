import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Superadmin | Artin Driving School',
};

export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
    return children;
}
