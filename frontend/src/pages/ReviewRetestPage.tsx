import FindingsPage from "./FindingsPage";

export default function ReviewRetestPage() {
  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-bold text-white">Review & Retest</h1>
        <p className="text-xs text-gray-400">Review findings, approvals, and retest backlog.</p>
      </div>
      <FindingsPage />
    </div>
  );
}
