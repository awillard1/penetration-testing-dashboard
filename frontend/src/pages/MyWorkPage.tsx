import TasksPage from "./TasksPage";

export default function MyWorkPage() {
  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-bold text-white">My Work Queue</h1>
        <p className="text-xs text-gray-400">Unified queue for operator tasks and testing follow-up.</p>
      </div>
      <TasksPage />
    </div>
  );
}
