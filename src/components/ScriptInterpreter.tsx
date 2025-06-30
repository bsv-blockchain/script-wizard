
import React, { useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import StackVisualizer from "./StackVisualizer";
import ScriptDisplay from "./ScriptDisplay";
import { parseScript, executeStep, ScriptState, ScriptInstruction } from "@/utils/scriptUtils";
import { useToast } from "@/hooks/use-toast";

const ScriptInterpreter = () => {
  const [unlockingScript, setUnlockingScript] = useState("OP_1\nOP_2\nOP_ADD");
  const [lockingScript, setLockingScript] = useState("OP_3\nOP_EQUAL");
  const [scriptState, setScriptState] = useState<ScriptState | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const { toast } = useToast();

  const initializeExecution = useCallback(() => {
    try {
      const unlockingInstructions = parseScript(unlockingScript);
      const lockingInstructions = parseScript(lockingScript);
      
      const combinedInstructions = [...unlockingInstructions, ...lockingInstructions];
      
      const initialState: ScriptState = {
        instructions: combinedInstructions,
        currentIndex: 0,
        stack: [],
        altStack: [],
        isComplete: false,
        isValid: false,
        unlockingScriptLength: unlockingInstructions.length,
        context: 'UnlockingScript' as const
      };
      
      setScriptState(initialState);
      setIsExecuting(true);
      
      toast({
        title: "Script Initialized",
        description: `Ready to execute ${combinedInstructions.length} instructions`,
      });
    } catch (error) {
      toast({
        title: "Parse Error",
        description: error instanceof Error ? error.message : "Failed to parse script",
        variant: "destructive",
      });
    }
  }, [unlockingScript, lockingScript, toast]);

  const executeNextStep = useCallback(() => {
    if (!scriptState || scriptState.isComplete) return;
    
    try {
      const newState = executeStep(scriptState);
      setScriptState(newState);
      
      if (newState.isComplete) {
        setIsExecuting(false);
        toast({
          title: newState.isValid ? "Script Valid!" : "Script Invalid",
          description: newState.isValid 
            ? "Script executed successfully" 
            : "Script execution failed",
          variant: newState.isValid ? "default" : "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Execution Error",
        description: error instanceof Error ? error.message : "Failed to execute instruction",
        variant: "destructive",
      });
      setIsExecuting(false);
    }
  }, [scriptState, toast]);

  const resetExecution = useCallback(() => {
    setScriptState(null);
    setIsExecuting(false);
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column - Script Input */}
      <div className="space-y-6">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-orange-400">Unlocking Script (scriptSig)</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={unlockingScript}
              onChange={(e) => setUnlockingScript(e.target.value)}
              placeholder="Enter unlocking script (one instruction per line)&#10;Example:&#10;OP_1&#10;OP_2&#10;OP_ADD"
              className="font-mono bg-slate-900 border-slate-600 text-green-400 min-h-32"
              disabled={isExecuting}
            />
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-orange-400">Locking Script (scriptPubKey)</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={lockingScript}
              onChange={(e) => setLockingScript(e.target.value)}
              placeholder="Enter locking script (one instruction per line)&#10;Example:&#10;OP_3&#10;OP_EQUAL"
              className="font-mono bg-slate-900 border-slate-600 text-blue-400 min-h-32"
              disabled={isExecuting}
            />
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button 
            onClick={initializeExecution} 
            disabled={isExecuting}
            className="bg-orange-600 hover:bg-orange-700"
          >
            Initialize Script
          </Button>
          <Button 
            onClick={executeNextStep} 
            disabled={!isExecuting || (scriptState?.isComplete ?? true)}
            variant="outline"
            className="border-green-600 text-green-400 hover:bg-green-600 hover:text-white"
          >
            Step Forward
          </Button>
          <Button 
            onClick={resetExecution} 
            disabled={!scriptState}
            variant="outline"
            className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
          >
            Reset
          </Button>
        </div>
      </div>

      {/* Right Column - Execution Visualization */}
      <div className="space-y-6">
        {scriptState && (
          <>
            <ScriptDisplay 
              instructions={scriptState.instructions}
              currentIndex={scriptState.currentIndex}
              unlockingScriptLength={scriptState.unlockingScriptLength}
            />
            <Separator className="bg-slate-600" />
            <StackVisualizer 
              stack={scriptState.stack}
              altStack={scriptState.altStack}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default ScriptInterpreter;
