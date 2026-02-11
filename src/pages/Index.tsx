
import { useState } from "react";
import ScriptInterpreter from "@/components/ScriptInterpreter";

const Index = () => {
  const [isExecuting, setIsExecuting] = useState(false);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="container mx-auto py-8">
        {/* Only show heading when not executing */}
        {!isExecuting && (
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2 text-blue-400">Script Wizard</h1>
            <p className="text-lg text-slate-300">BSV Blockchain Script Visualizer &amp; Debugger</p>
          </div>
        )}
        <ScriptInterpreter onExecutionStateChange={setIsExecuting} />
      </div>
    </div>
  );
};

export default Index;
