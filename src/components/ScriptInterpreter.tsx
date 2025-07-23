
import React, { useState, useCallback, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import StackVisualizer from "./StackVisualizer";
import ScriptDisplay from "./ScriptDisplay";
import { parseScript, executeStep, ScriptState, ScriptInstruction } from "@/utils/scriptUtils";
import { parseScriptParamsFromUrl, generateShareableUrl, updateUrlWithScripts } from "@/utils/urlUtils";
import { useToast } from "@/hooks/use-toast";
import { Share2, Copy } from "lucide-react";

const ScriptInterpreter = () => {
  const [unlockingScript, setUnlockingScript] = useState("");
  const [lockingScript, setLockingScript] = useState("");
  const [scriptState, setScriptState] = useState<ScriptState | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [breakpoints, setBreakpoints] = useState<number[]>([]);
  const { toast } = useToast();

  // Load scripts from URL parameters on component mount
  useEffect(() => {
    const urlParams = parseScriptParamsFromUrl();
    if (urlParams.unlock || urlParams.lock) {
      if (urlParams.unlock) {
        setUnlockingScript(urlParams.unlock);
      }
      if (urlParams.lock) {
        setLockingScript(urlParams.lock);
      }
    }
    if (urlParams.breakpoints) {
      setBreakpoints(urlParams.breakpoints);
    }
  }, [toast]);

  // Update URL when scripts change (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      updateUrlWithScripts(unlockingScript, lockingScript, breakpoints);
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [unlockingScript, lockingScript, breakpoints]);

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

  const toggleBreakpoint = useCallback((index: number) => {
    setBreakpoints((prev) =>
      prev.includes(index)
        ? prev.filter((bp) => bp !== index)
        : [...prev, index].sort((a, b) => a - b)
    );
  }, []);

  const continueExecution = useCallback(() => {
    if (!scriptState || scriptState.isComplete) return;
    let state = scriptState;
    do {
      state = executeStep(state);
    } while (!state.isComplete && !breakpoints.includes(state.currentIndex));
    setScriptState(state);

    if (state.isComplete) {
      setIsExecuting(false);
      toast({
        title: state.isValid ? 'Script Valid!' : 'Script Invalid',
        description: state.isValid
          ? 'Script executed successfully'
          : 'Script execution failed',
        variant: state.isValid ? 'default' : 'destructive',
      });
    }
  }, [scriptState, breakpoints, toast]);

  const runToEnd = useCallback(() => {
    if (!scriptState || scriptState.isComplete) return;
    let state = scriptState;
    while (!state.isComplete) {
      state = executeStep(state);
    }
    setScriptState(state);
    setIsExecuting(false);
    toast({
      title: state.isValid ? 'Script Valid!' : 'Script Invalid',
      description: state.isValid
        ? 'Script executed successfully'
        : 'Script execution failed',
      variant: state.isValid ? 'default' : 'destructive',
    });
  }, [scriptState, toast]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F10') {
        event.preventDefault();
        executeNextStep();
      }
      if (event.key === 'F5') {
        event.preventDefault();
        continueExecution();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [executeNextStep, continueExecution]);

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

  const shareScript = useCallback(async () => {
    const shareableUrl = generateShareableUrl(
      unlockingScript,
      lockingScript,
      breakpoints
    );
    
    try {
      await navigator.clipboard.writeText(shareableUrl);
      toast({
        title: "Link Copied!",
        description: "Shareable link has been copied to your clipboard",
      });
    } catch (error) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = shareableUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      toast({
        title: "Link Copied!",
        description: "Shareable link has been copied to your clipboard",
      });
    }
  }, [unlockingScript, lockingScript, breakpoints, toast]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column - Script Input */}
      <div className="space-y-6">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-gray-400">Unlocking Script</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={unlockingScript}
              onChange={(e) => setUnlockingScript(e.target.value)}
              placeholder="Enter unlocking script&#10;Example:&#10;OP_1&#10;OP_2"
              className="font-mono bg-slate-900 border-slate-600 text-green-400 min-h-32"
              disabled={isExecuting}
            />
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-gray-400">Locking Script</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={lockingScript}
              onChange={(e) => setLockingScript(e.target.value)}
              placeholder="Enter locking script&#10;Example:&#10;OP_ADD&#10;OP_3&#10;OP_EQUAL"
              className="font-mono bg-slate-900 border-slate-600 text-red-400 min-h-32"
              disabled={isExecuting}
            />
          </CardContent>
        </Card>

        <div className="flex gap-3 flex-wrap">
          <Button 
            onClick={initializeExecution} 
            disabled={isExecuting}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Initialize Execution
          </Button>
          <Button
            onClick={executeNextStep}
            disabled={!scriptState || scriptState.isComplete}
            variant="outline"
            className="border-blue-400 text-blue-400 hover:bg-blue-400 hover:text-slate-900"
          >
            Next Step
          </Button>
          <Button
            onClick={continueExecution}
            disabled={!scriptState || scriptState.isComplete}
            variant="outline"
            className="border-blue-400 text-blue-400 hover:bg-blue-400 hover:text-slate-900"
          >
            Continue
          </Button>
          <Button
            onClick={runToEnd}
            disabled={!scriptState || scriptState.isComplete}
            variant="outline"
            className="border-blue-400 text-blue-400 hover:bg-blue-400 hover:text-slate-900"
          >
            Run To End
          </Button>
          <Button 
            onClick={resetExecution} 
            disabled={!scriptState}
            variant="outline"
            className="border-slate-400 text-slate-400 hover:bg-slate-400 hover:text-slate-900"
          >
            Reset
          </Button>
          <Button 
            onClick={shareScript}
            variant="outline"
            className="border-blue-400 text-blue-400 hover:bg-blue-400 hover:text-slate-900 gap-2"
          >
            <Share2 size={16} />
            Share Script
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
              breakpoints={breakpoints}
              onToggleBreakpoint={toggleBreakpoint}
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
