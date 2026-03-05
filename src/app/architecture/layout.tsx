import { Navigation } from "@/components/navigation";

export default function ArchitectureLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-void">
            <Navigation />
            {children}
        </div>
    );
}
