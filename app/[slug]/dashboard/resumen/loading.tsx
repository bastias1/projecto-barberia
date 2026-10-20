import { StatsCardsLoading, PageHeaderLoading } from "@/components/dashboard/loading-skeletons";

export default function ResumenLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderLoading />
      <StatsCardsLoading />
    </div>
  );
}
