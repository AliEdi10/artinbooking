import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'My Portal | Artin Driving School',
};

export default function StudentLayout({ children }: { children: React.ReactNode }) {
    return children;
}
