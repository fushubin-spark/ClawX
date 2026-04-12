/**
 * Hermes Instance Card
 * Displays a Hermes instance with status and quick actions
 */
import { useHermesStore, type HermesInstanceStatus } from '@/stores/hermes';

interface Props {
  instance: HermesInstanceStatus;
  isSelected: boolean;
  onSelect: () => void;
}

const STATE_COLORS = {
  stopped: 'bg-zinc-600',
  starting: 'bg-amber-500',
  running: 'bg-emerald-500',
  error: 'bg-red-500',
};

const STATE_TEXT = {
  stopped: 'Stopped',
  starting: 'Starting...',
  running: 'Running',
  error: 'Error',
};

export function InstanceCard({ instance, isSelected, onSelect }: Props) {
  const { startInstance, stopInstance, restartInstance, removeInstance } = useHermesStore();

  const handleStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    startInstance(instance.id);
  };

  const handleStop = (e: React.MouseEvent) => {
    e.stopPropagation();
    stopInstance(instance.id);
  };

  const handleRestart = (e: React.MouseEvent) => {
    e.stopPropagation();
    restartInstance(instance.id);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Remove instance "${instance.name}"?`)) {
      removeInstance(instance.id);
    }
  };

  const uptime = instance.uptime
    ? `${Math.floor(instance.uptime / 60)}m ${instance.uptime % 60}s`
    : null;

  return (
    <div
      onClick={onSelect}
      className={`
        relative cursor-pointer rounded-lg border p-4 transition-all
        ${isSelected
          ? 'border-blue-500 bg-blue-950/30'
          : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600'
        }
      `}
    >
      {/* Color indicator stripe */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
        style={{ backgroundColor: instance.color }}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${STATE_COLORS[instance.state]}`} />
          <span className="font-medium text-white">{instance.name}</span>
        </div>
        <span className="text-xs text-zinc-400">{STATE_TEXT[instance.state]}</span>
      </div>

      {/* Info */}
      <div className="space-y-1 text-xs text-zinc-400 mb-3 ml-2">
        <div className="truncate" title={instance.hermesHome}>
          📁 {instance.hermesHome}
        </div>
        {instance.pid && (
          <div>PID: {instance.pid}</div>
        )}
        {uptime && (
          <div>⏱ {uptime}</div>
        )}
        {instance.error && (
          <div className="text-red-400 truncate" title={instance.error}>
            ⚠ {instance.error}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {instance.state === 'stopped' || instance.state === 'error' ? (
          <button
            onClick={handleStart}
            className="flex-1 text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
          >
            ▶ Start
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="flex-1 text-xs px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors"
          >
            ⏹ Stop
          </button>
        )}
        {instance.state === 'running' && (
          <button
            onClick={handleRestart}
            className="flex-1 text-xs px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded transition-colors"
          >
            🔄 Restart
          </button>
        )}
        <button
          onClick={handleRemove}
          className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-red-900 text-zinc-300 hover:text-white rounded transition-colors"
        >
          🗑
        </button>
      </div>
    </div>
  );
}
