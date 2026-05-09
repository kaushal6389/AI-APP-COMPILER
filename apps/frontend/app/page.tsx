"use client";

// mock implementation of a Next.js Dashboard
import React, { useEffect, useState } from 'react';
import { AppManifest, DesignIR, IntentIR } from '@ai-compiler/schemas';

export type PipelineArtifacts = {
  outDir: string;
  files: string[];
};

type PipelineState = {
  stage: number;
  intentIR: IntentIR | null;
  designIR: DesignIR | null;
  targetManifest: AppManifest | null;
  validationLogs: Array<any>;
  trace: Array<any>;
  summary: any | null;
  codeArtifacts: PipelineArtifacts | null;
};

/**
 * AI App Compiler Dashboard
 * Fulfills the UI requirements to enter prompts, view stages, and inspect JSON.
 */
export default function Dashboard() {
  const [prompt, setPrompt] = useState("");
  const [promptHistory, setPromptHistory] = useState<Array<{ prompt: string; timestamp: string }>>([]);
  const [pipelineState, setPipelineState] = useState<PipelineState>({
    stage: 0,
    intentIR: null,
    designIR: null,
    targetManifest: null,
    validationLogs: [],
    trace: [],
    summary: null,
    codeArtifacts: null
  });
  const [benchmarkState, setBenchmarkState] = useState<any>(null);
  const [benchmarkRunning, setBenchmarkRunning] = useState(false);
  const [artifactView, setArtifactView] = useState({
    manifest: true,
    summary: true,
    validation: true,
    artifacts: true,
    benchmark: true,
    readiness: true
  });

  const toggleArtifactView = (key: keyof typeof artifactView) => {
    setArtifactView((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    const saved = localStorage.getItem('promptHistory');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setPromptHistory(parsed);
        }
      } catch (error) {
        console.error('Failed to load prompt history', error);
      }
    }
  }, []);

  const updatePromptHistory = (currentPrompt: string) => {
    const trimmed = currentPrompt.trim();
    if (!trimmed) return;

    const next = [{ prompt: trimmed, timestamp: new Date().toISOString() }, ...promptHistory]
      .filter((item, index, self) => self.findIndex((x) => x.prompt === item.prompt) === index)
      .slice(0, 10);
    setPromptHistory(next);
    localStorage.setItem('promptHistory', JSON.stringify(next));
  };

  const copyToClipboard = async (label: string, value: any) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
      alert(`${label} copied to clipboard`);
    } catch (error) {
      console.error(error);
      alert('Copy failed');
    }
  };

  const roleMatch = (() => {
    const match = /roles?\s*[:=]\s*([a-z0-9,\s]+)/i.exec(prompt);
    if (!match) return null;
    const promptRoles = match[1]
      .split(',')
      .map((role) => role.trim())
      .filter(Boolean);
    const extractedRoles = pipelineState.intentIR?.primaryRoles?.map((role: any) => role.name) || [];
    const missingRoles = promptRoles.filter((role) => !extractedRoles.includes(role));
    const extraRoles = extractedRoles.filter((role: string) => !promptRoles.includes(role));
    return {
      promptRoles,
      extractedRoles,
      missingRoles,
      extraRoles,
      isConsistent: missingRoles.length === 0 && extraRoles.length === 0
    };
  })();

  const repairActions = pipelineState.trace
    .filter((event: any) => event.type === 'REPAIR_APPLIED')
    .map((event: any, index: number) => ({
      id: `${index + 1}`,
      message: typeof event.data === 'string' ? event.data : 'Repair applied'
    }));

  const manifestIntegrity = (() => {
    const required = pipelineState.intentIR?.requiredEntities?.map((entity: any) => entity.name) || [];
    const dbEntities = pipelineState.targetManifest?.database?.map((db: any) => db.name) || [];
    const apiEntities = new Set((pipelineState.targetManifest?.api || []).flatMap((route: any) => route.touchesEntities || []));
    const missingEntities = required.filter((entity: string) => !dbEntities.includes(entity));
    const missingRoutes = dbEntities.filter((entity: string) => !apiEntities.has(entity));
    return {
      missingEntities,
      missingRoutes,
      isHealthy: missingEntities.length === 0 && missingRoutes.length === 0
    };
  })();

  const handleCompile = async () => {
    if (!prompt) return;
    
    // Reset state & start
    setPipelineState({
      stage: 0,
      intentIR: null,
      designIR: null,
      targetManifest: null,
      validationLogs: [],
      trace: [],
      summary: null,
      codeArtifacts: null
    });

    try {
      const response = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      const data = await response.json();

      if (response.ok) {
        setPipelineState({
          stage: data.trace?.length ? 6 : 0,
          intentIR: data.intentIR,
          designIR: data.designIR,
          targetManifest: data.manifest,
          validationLogs: data.trace?.filter((event: any) => event.type === 'VALIDATION_FAILED' || event.type === 'REPAIR_APPLIED') || [],
          trace: data.trace || [],
          summary: data.summary || null,
          codeArtifacts: data.codeArtifacts || null
        });
        updatePromptHistory(prompt);
      } else {
        alert("Compilation Error: " + data.error);
        setPipelineState(prev => ({ ...prev, stage: 0 }));
      }
    } catch (error) {
      console.error(error);
      alert("Network Error calling execution engine.");
    }
  };

  const handleBenchmark = async () => {
    setBenchmarkRunning(true);
    setBenchmarkState(null);

    try {
      const response = await fetch('/api/benchmark', { method: 'POST' });
      const data = await response.json();

      if (response.ok) {
        setBenchmarkState(data);
      } else {
        alert("Benchmark Error: " + data.error);
      }
    } catch (error) {
      console.error(error);
      alert("Network Error running benchmarks.");
    } finally {
      setBenchmarkRunning(false);
    }
  };

  const handleSelectHistory = (value: string) => {
    setPrompt(value);
  };

  const handleClearHistory = () => {
    setPromptHistory([]);
    localStorage.removeItem('promptHistory');
  };

  const handleExportLogs = () => {
    const payload = {
      prompt,
      trace: pipelineState.trace,
      summary: pipelineState.summary,
      validationLogs: pipelineState.validationLogs,
      manifest: pipelineState.targetManifest
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'compiler-trace.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-4">AI App Compiler Architecture</h1>
      
      <div className="grid grid-cols-3 gap-6">
        {/* Left Column: Input */}
        <div className="col-span-1 bg-gray-800 p-4 rounded-xl border border-gray-700">
          <h2 className="text-xl mb-2">1. Input Requirements</h2>
          <textarea 
            className="w-full h-32 bg-gray-950 p-2 rounded text-sm text-green-400 font-mono"
            placeholder="Describe your SaaS or app idea..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <button 
            onClick={handleCompile}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-500 py-2 rounded font-semibold transition"
          >
            Start Compilation Pipeline
          </button>
          <button
            onClick={handleBenchmark}
            disabled={benchmarkRunning}
            className="mt-3 w-full bg-gray-700 hover:bg-gray-600 py-2 rounded font-semibold transition disabled:opacity-60"
          >
            {benchmarkRunning ? 'Running Benchmarks...' : 'Run Benchmark Suite'}
          </button>
          <button
            onClick={handleExportLogs}
            className="mt-3 w-full bg-gray-700 hover:bg-gray-600 py-2 rounded font-semibold transition"
          >
            Export Execution Logs
          </button>
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Prompt History</span>
              <button
                onClick={handleClearHistory}
                className="text-xs text-gray-500 underline"
              >
                Clear
              </button>
            </div>
            <div className="mt-2 space-y-2 text-xs">
              {promptHistory.length > 0 ? (
                promptHistory.map((item, index) => (
                  <button
                    key={`${item.timestamp}-${index}`}
                    onClick={() => handleSelectHistory(item.prompt)}
                    className="w-full text-left bg-gray-950 text-gray-200 px-2 py-2 rounded border border-gray-700 hover:border-gray-500"
                  >
                    <div className="text-gray-400">{new Date(item.timestamp).toLocaleString()}</div>
                    <div className="truncate">{item.prompt}</div>
                  </button>
                ))
              ) : (
                <div className="text-gray-600">No history yet</div>
              )}
            </div>
          </div>
        </div>

        {/* Middle Column: Pipeline View */}
        <div className="col-span-1 bg-gray-800 p-4 rounded-xl border border-gray-700">
          <h2 className="text-xl mb-4">2. Execution Trace</h2>
          <div className="text-xs text-gray-400 mb-4">
            {pipelineState.trace.length > 0 ? `Events: ${pipelineState.trace.length}` : 'Awaiting execution...'}
          </div>
          {pipelineState.intentIR?.domain && (
            <div className="mb-4 text-xs text-sky-300">
              Domain: {pipelineState.intentIR.domain}
            </div>
          )}
          {pipelineState.intentIR?.requiredEntities?.length ? (
            <div className="mb-4 text-xs text-sky-200">
              Inferred Entities: {pipelineState.intentIR.requiredEntities.map((entity: any) => entity.name).join(', ')}
            </div>
          ) : null}
          {pipelineState.intentIR?.impliedIntegrations?.length ? (
            <div className="mb-4 text-xs text-sky-200">
              Integrations: {pipelineState.intentIR.impliedIntegrations.map((integration: any) => integration.provider).join(', ')}
            </div>
          ) : null}
          {pipelineState.intentIR?.impliedIntegrations?.some((integration: any) => integration.purpose === 'Billing') &&
            pipelineState.intentIR?.requiredEntities?.every((entity: any) => entity.name !== 'Payment') && (
            <div className="mb-4 text-xs text-red-300">
              Missing Entity: Payment required for billing integration
            </div>
          )}
          {roleMatch && (
            <div className={roleMatch.isConsistent ? "mb-4 text-xs text-green-300" : "mb-4 text-xs text-red-300"}>
              Role Consistency: {roleMatch.isConsistent ? 'PASS' : 'FAIL'}
            </div>
          )}
          <div className={pipelineState.validationLogs.length > 0 ? "mb-4 text-xs text-orange-300" : "mb-4 text-xs text-green-300"}>
            Validation Status: {pipelineState.validationLogs.length > 0 ? 'WARNINGS' : 'PASS'}
          </div>
          <div className="mb-4 text-xs text-orange-200">
            Repair Count: {repairActions.length}
          </div>
          <div className={manifestIntegrity.isHealthy ? "mb-4 text-xs text-green-300" : "mb-4 text-xs text-red-300"}>
            Manifest Integrity: {manifestIntegrity.isHealthy ? 'PASS' : 'FAIL'}
          </div>
          {!manifestIntegrity.isHealthy && (
            <div className="mb-4 text-xs text-red-300">
              {manifestIntegrity.missingEntities.length > 0 && (
                <div>Missing Entities: {manifestIntegrity.missingEntities.join(', ')}</div>
              )}
              {manifestIntegrity.missingRoutes.length > 0 && (
                <div>Missing Routes: {manifestIntegrity.missingRoutes.join(', ')}</div>
              )}
            </div>
          )}
          <ul className="space-y-4">
            <li className={pipelineState.stage >= 1 ? "text-green-400 font-bold" : "text-gray-500"}>
              {pipelineState.stage >= 1 ? "✔" : "⏳"} [Stage 1] Intent Extraction
            </li>
            <li className={pipelineState.stage >= 2 ? "text-green-400 font-bold" : "text-gray-500"}>
              {pipelineState.stage >= 2 ? "✔" : "⏳"} [Stage 2] System Design Generation
            </li>
            <li className={pipelineState.stage >= 3 ? "text-green-400 font-bold" : "text-gray-500"}>
              {pipelineState.stage >= 3 ? "✔" : "⏳"} [Stage 3] Database & API Schema Generation
            </li>
            <li className={pipelineState.stage >= 4 ? "text-green-400 font-bold" : "text-gray-500"}>
              {pipelineState.stage >= 4 ? "✔" : "⏳"} [Stage 4] strict Cross-Schema Validation
            </li>
            <li className={pipelineState.stage >= 5 ? "text-orange-400 font-bold" : "text-gray-500"}>
              {pipelineState.stage >= 5 ? "🔧" : "⏳"} [Stage 5] Auto-Repair Engine
            </li>
            <li className={pipelineState.stage >= 6 ? "text-blue-400 font-bold" : "text-gray-500"}>
              {pipelineState.stage >= 6 ? "✔" : "⏳"} [Stage 6] Runtime Code Transpilation
            </li>
          </ul>
          {pipelineState.trace.length > 0 && (
            <pre className="mt-4 bg-gray-950 p-2 rounded text-xs overflow-x-auto text-green-300">
              {JSON.stringify(pipelineState.trace.map((event: any) => ({
                type: event.type,
                durationMs: event.data?.durationMs,
                confidence: event.data?.confidence,
                data: event.type.endsWith('_END') ? undefined : event.data
              })), null, 2)}
            </pre>
          )}
        </div>

        {/* Right Column: Artifacts */}
        <div className="col-span-1 bg-gray-800 p-4 rounded-xl border border-gray-700 overflow-y-auto max-h-[80vh]">
          <h2 className="text-xl mb-2">3. Generated Artifacts</h2>
          <div className="mb-4">
            <button
              onClick={() => toggleArtifactView('manifest')}
              className="text-sm text-gray-400 underline"
            >
              Validated JSON Schema Map (Manifest)
            </button>
            <button
              onClick={() => copyToClipboard('Manifest', pipelineState.targetManifest)}
              className="ml-2 text-xs text-gray-400 underline"
            >
              Copy
            </button>
            {artifactView.manifest && (
              <pre className="bg-gray-950 p-2 rounded text-xs overflow-x-auto text-yellow-300">
                {pipelineState.targetManifest ? JSON.stringify(pipelineState.targetManifest, null, 2) : "// Awaiting pipeline..."}
              </pre>
            )}
          </div>
          <div className="mb-4">
            <button
              onClick={() => toggleArtifactView('summary')}
              className="text-sm text-gray-400 underline"
            >
              Execution Summary
            </button>
            <button
              onClick={() => copyToClipboard('Execution Summary', pipelineState.summary)}
              className="ml-2 text-xs text-gray-400 underline"
            >
              Copy
            </button>
            {artifactView.summary && (
              <pre className="bg-gray-950 p-2 rounded text-xs overflow-x-auto text-green-300">
                {pipelineState.summary
                  ? JSON.stringify(pipelineState.summary, null, 2)
                  : "// Summary pending"}
              </pre>
            )}
          </div>
          {pipelineState.summary?.stageTimings && (
            <div className="mb-4">
              <h3 className="text-sm text-gray-400">Stage Timings (ms)</h3>
              <pre className="bg-gray-950 p-2 rounded text-xs overflow-x-auto text-emerald-300">
                {JSON.stringify(pipelineState.summary.stageTimings, null, 2)}
              </pre>
            </div>
          )}
          <div className="mb-4">
            <button
              onClick={() => toggleArtifactView('validation')}
              className="text-sm text-gray-400 underline"
            >
              Validation + Repair Logs
            </button>
            <button
              onClick={() => copyToClipboard('Validation Logs', pipelineState.validationLogs)}
              className="ml-2 text-xs text-gray-400 underline"
            >
              Copy
            </button>
            {artifactView.validation && (
              <pre className="bg-gray-950 p-2 rounded text-xs overflow-x-auto text-orange-300">
                {pipelineState.validationLogs.length > 0
                  ? JSON.stringify(pipelineState.validationLogs, null, 2)
                  : "// No validation logs yet"}
              </pre>
            )}
          </div>
          <div className="mb-4">
            <h3 className="text-sm text-gray-400">Repair Actions</h3>
            <div className="bg-gray-950 p-2 rounded text-xs text-orange-200">
              {repairActions.length > 0
                ? repairActions.map((action: any) => (
                    <div key={action.id}>#{action.id} {action.message}</div>
                  ))
                : "// No repairs applied"}
            </div>
          </div>
          <div>
            <button
              onClick={() => toggleArtifactView('artifacts')}
              className="text-sm text-gray-400 underline"
            >
              Prisma Source Code Output
            </button>
            <button
              onClick={() => copyToClipboard('Code Artifacts', pipelineState.codeArtifacts)}
              className="ml-2 text-xs text-gray-400 underline"
            >
              Copy
            </button>
            {artifactView.artifacts && (
              <pre className="bg-gray-950 p-2 rounded text-xs overflow-x-auto text-pink-300">
                {pipelineState.codeArtifacts?.files ? JSON.stringify(pipelineState.codeArtifacts, null, 2) : "// Prisma model will appear here"}
              </pre>
            )}
          </div>
          <div className="mt-4">
            <button
              onClick={() => toggleArtifactView('benchmark')}
              className="text-sm text-gray-400 underline"
            >
              Benchmark Results
            </button>
            <button
              onClick={() => copyToClipboard('Benchmark Results', benchmarkState)}
              className="ml-2 text-xs text-gray-400 underline"
            >
              Copy
            </button>
            {artifactView.benchmark && (
              <pre className="bg-gray-950 p-2 rounded text-xs overflow-x-auto text-blue-300">
                {benchmarkState ? JSON.stringify(benchmarkState, null, 2) : "// Benchmark not run"}
              </pre>
            )}
          </div>
          {benchmarkState?.summary && (
            <div className="mt-4">
              <h3 className="text-sm text-gray-400">Benchmark Summary</h3>
              <div className="bg-gray-950 p-3 rounded text-xs text-blue-200 space-y-1">
                <div>Total: {benchmarkState.summary.total}</div>
                <div>Avg Entity Coverage: {benchmarkState.summary.avgEntityCoverage}</div>
                <div>Avg Role Coverage: {benchmarkState.summary.avgRoleCoverage}</div>
                <div>Avg Integration Coverage: {benchmarkState.summary.avgIntegrationCoverage}</div>
                <div>Avg Route Coverage: {benchmarkState.summary.avgRouteCoverage}</div>
                <div>Avg Hallucination Rate: {benchmarkState.summary.avgHallucinationRate}</div>
                <div>Avg Latency (ms): {benchmarkState.summary.avgLatencyMs}</div>
                <div>Runtime Success Rate: {benchmarkState.summary.runtimeSuccessRate}</div>
              </div>
            </div>
          )}
          <div className="mt-4">
            <button
              onClick={() => toggleArtifactView('readiness')}
              className="text-sm text-gray-400 underline"
            >
              Runtime Readiness
            </button>
            <button
              onClick={() => copyToClipboard('Runtime Readiness', pipelineState.codeArtifacts?.files)}
              className="ml-2 text-xs text-gray-400 underline"
            >
              Copy
            </button>
            {artifactView.readiness && (
              <pre className="bg-gray-950 p-2 rounded text-xs overflow-x-auto text-teal-300">
                {pipelineState.codeArtifacts?.files
                  ? JSON.stringify({ files: pipelineState.codeArtifacts.files }, null, 2)
                  : "// Readiness pending"}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
