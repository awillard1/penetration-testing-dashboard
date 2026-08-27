import RunnersPanel from "../components/settings/RunnersPanel";

export default function RunnersPage() {
  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-bold text-white">Runners</h1>
        <p className="text-xs text-gray-400">Runner registration, status, tokens, tools, and jobs.</p>
      </div>
      <RunnersPanel />
    </div>
  );
}
