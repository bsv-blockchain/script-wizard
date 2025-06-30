
import ScriptInterpreter from "@/components/ScriptInterpreter";

const Index = () => {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="container mx-auto py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4 text-orange-400">Bitcoin Script Interpreter</h1>
          <p className="text-xl text-slate-300">Step-by-step Bitcoin Script execution with visual stack representation</p>
        </div>
        <ScriptInterpreter />
      </div>
    </div>
  );
};

export default Index;
