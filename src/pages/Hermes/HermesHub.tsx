/**
 * Hermes Hub Page
 * Main dashboard for managing multiple Hermes instances
 */
import { useEffect, useState } from 'react';
import { useHermesStore } from '@/stores/hermes';
import { InstanceCard } from '@/components/hermes/InstanceCard';
import { InstanceConsole } from '@/components/hermes/InstanceConsole';
import { AddInstanceForm } from '@/components/hermes/AddInstanceForm';

export function HermesHub() {
  const {
    instances,
    selectedInstanceId,
    loading,
    error,
    fetchInstances,
    selectInstance,
  } = useHermesStore();

  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    fetchInstances();
    // Refresh instances every 5 seconds
    const interval = setInterval(fetchInstances, 5000);
    return () => clearInterval(interval);
  }, [fetchInstances]);

  const selectedInstance = instances.find(i => i.id === selectedInstanceId);

  return (
    <div className="flex h-full">
      {/* Left sidebar - Instance list */}
      <div className="w-80 border-r border-zinc-800 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-semibold text-white">Hermes Hub</h1>
            <button
              onClick={() => setShowAddForm(true)}
              className="w-8 h-8 flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
              title="Add Instance"
            >
              +
            </button>
          </div>
          <p className="text-xs text-zinc-500">
            {instances.length} instance{instances.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Instance cards */}
        <div className="flex-1 overflow-auto p-3 space-y-3">
          {loading && instances.length === 0 ? (
            <div className="text-center text-zinc-500 py-8">Loading...</div>
          ) : instances.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-zinc-600 mb-3">No instances yet</div>
              <button
                onClick={() => setShowAddForm(true)}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                + Add your first instance
              </button>
            </div>
          ) : (
            instances.map(instance => (
              <InstanceCard
                key={instance.id}
                instance={instance}
                isSelected={instance.id === selectedInstanceId}
                onSelect={() => selectInstance(instance.id)}
              />
            ))
          )}
        </div>

        {/* Error display */}
        {error && (
          <div className="p-3 border-t border-zinc-800">
            <div className="text-xs text-red-400 bg-red-950/50 p-2 rounded">
              {error}
            </div>
          </div>
        )}
      </div>

      {/* Right content - Console */}
      <div className="flex-1 flex flex-col">
        {selectedInstance ? (
          <>
            {/* Instance header */}
            <div
              className="px-6 py-4 border-b border-zinc-800 flex items-center gap-3"
              style={{ borderLeftWidth: 4, borderLeftColor: selectedInstance.color }}
            >
              <div>
                <h2 className="text-white font-medium">{selectedInstance.name}</h2>
                <p className="text-xs text-zinc-500">{selectedInstance.hermesHome}</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  selectedInstance.state === 'running' ? 'bg-emerald-500' :
                  selectedInstance.state === 'starting' ? 'bg-amber-500' :
                  selectedInstance.state === 'error' ? 'bg-red-500' : 'bg-zinc-600'
                }`} />
                <span className="text-sm text-zinc-400">{selectedInstance.state}</span>
              </div>
            </div>

            {/* Console */}
            <div className="flex-1 p-4">
              <InstanceConsole instanceId={selectedInstance.id} />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-4">🤖</div>
              <h2 className="text-lg font-medium text-zinc-300 mb-2">Select an Instance</h2>
              <p className="text-sm text-zinc-500">
                Choose an instance from the list to view its console output
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Add Instance Modal */}
      {showAddForm && <AddInstanceForm onClose={() => setShowAddForm(false)} />}
    </div>
  );
}
