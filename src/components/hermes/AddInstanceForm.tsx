/**
 * Add Hermes Instance Form
 */
import { useState } from 'react';
import { useHermesStore } from '@/stores/hermes';

interface Props {
  onClose: () => void;
}

export function AddInstanceForm({ onClose }: Props) {
  const [name, setName] = useState('');
  const [hermesHome, setHermesHome] = useState('');
  const [error, setError] = useState('');
  const { addInstance } = useHermesStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!hermesHome.trim()) {
      setError('Hermes Home path is required');
      return;
    }

    try {
      await addInstance(name.trim(), hermesHome.trim());
      onClose();
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold text-white mb-4">Add Hermes Instance</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Instance Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Work Bot"
              className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Hermes Home Path</label>
            <input
              type="text"
              value={hermesHome}
              onChange={(e) => setHermesHome(e.target.value)}
              placeholder="e.g. /Users/sparkfu/.hermes"
              className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Each instance needs its own Hermes Home directory with config.yaml
            </p>
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-950/50 p-2 rounded">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
              Add Instance
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
