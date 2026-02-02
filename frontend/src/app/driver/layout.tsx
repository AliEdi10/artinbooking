import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Instructor Portal | Artin Driving School',
};

export default function DriverLayout({ children }: { children: React.ReactNode }) {
    return children;
}
