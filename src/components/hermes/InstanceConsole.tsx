/**
 * Hermes Instance Console
 * Real-time terminal output for a Hermes instance
 */
import { useEffect, useRef, useState } from 'react';
import { useHermesStore } from '@/stores/hermes';

interface Props {
  instanceId: string;
}

export function InstanceConsole({ instanceId }: Props) {
  const { outputs, refreshOutput, injectCommand } = useHermesStore();
  const [command, setCommand] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const output = outputs[instanceId] || [];

  // Auto-refresh output
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      refreshOutput(instanceId);
    }, 2000);
    return () => clearInterval(interval);
  }, [instanceId, autoRefresh, refreshOutput]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [output]);

  const handleInject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;
    injectCommand(instanceId, command);
    setCommand('');
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 rounded-lg border border-zinc-800">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
        <span className="text-sm font-medium text-zinc-300">Terminal Output</span>
        <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="rounded"
          />
          Auto-refresh
        </label>
      </div>

      {/* Output area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto p-4 font-mono text-xs text-zinc-300 whitespace-pre-wrap"
      >
        {output.length === 0 ? (
          <span className="text-zinc-600">No output yet. Start the instance to see logs.</span>
        ) : (
          output.map((line, i) => (
            <div
              key={i}
              className={
                line.startsWith('[ERR]') || line.startsWith('Error')
                  ? 'text-red-400'
                  : line.startsWith('[INFO]')
                  ? 'text-blue-400'
                  : ''
              }
            >
              {line}
            </div>
          ))
        )}
      </div>

      {/* Command input */}
      <form onSubmit={handleInject} className="flex gap-2 p-3 border-t border-zinc-800">
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="Inject command..."
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}
