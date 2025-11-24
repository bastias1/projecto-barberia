import { Suspense } from "react";
import { StoreHeader } from "@/components/shop/store-header";

export default function CheckoutLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
            <div className="max-w-[1600px] mx-auto px-6 py-8">
                <Suspense fallback={<div className="h-20" />}>
                    <StoreHeader />
                </Suspense>
                {children}
            </div>
        </div>
    );
}
