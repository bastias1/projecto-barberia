import { StoreHeader } from "@/components/shop/store-header";

export default function StoreLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
            <div className="max-w-[1600px] mx-auto px-6 py-8">
                <StoreHeader />
                {children}
            </div>
        </div>
    );
}
