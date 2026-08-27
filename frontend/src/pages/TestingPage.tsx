import TasksPage from "./TasksPage";

export default function TestingPage() {
  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-bold text-white">Testing Queue</h1>
        <p className="text-xs text-gray-400">Track methodology, endpoint, and execution testing tasks.</p>
      </div>
      <TasksPage />
    </div>
  );
}
