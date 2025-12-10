import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { WebSocketProvider } from '@/contexts/WebSocketContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'Clipboard Sync - Multi-Device Clipboard Synchronization',
    description: 'Seamlessly sync your clipboard across all your devices with end-to-end encryption',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <AuthProvider>
                    <WebSocketProvider>
                        {children}
                    </WebSocketProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
