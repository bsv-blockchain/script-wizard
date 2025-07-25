
import React, { useState, useCallback, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import StackVisualizer from "./StackVisualizer";
import ScriptDisplay from "./ScriptDisplay";
import { parseScript, executeStep, executeRun, executeToNextBreakpoint, toggleBreakpoint, findNextBreakpoint, ScriptState, ScriptInstruction } from "@/utils/scriptUtils";
import { parseScriptParamsFromUrl, generateShareableUrl, updateUrlWithScripts } from "@/utils/urlUtils";
import { useToast } from "@/hooks/use-toast";
import { Share2, Copy, Play, Pause, SkipForward, RotateCcw } from "lucide-react";

const ScriptInterpreter = () => {
  const [unlockingScript, setUnlockingScript] = useState("");
  const [lockingScript, setLockingScript] = useState("");
  const [scriptState, setScriptState] = useState<ScriptState | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

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
  }, [toast]);



  // Update URL when scripts change (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      updateUrlWithScripts(unlockingScript, lockingScript);
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [unlockingScript, lockingScript]);

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
          description: newState.executionError || (newState.isValid 
            ? "Script executed successfully" 
            : "Script execution failed"),
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

  const executeRunMode = useCallback(() => {
    if (!scriptState || scriptState.isComplete) return;
    
    setIsRunning(true);
    
    // Use setTimeout to allow UI to update
    setTimeout(() => {
      try {
        const newState = executeRun(scriptState);
        setScriptState(newState);
        setIsRunning(false);
        
        if (newState.isComplete) {
          setIsExecuting(false);
          toast({
            title: newState.isValid ? "Script Valid!" : "Script Invalid",
            description: newState.executionError || (newState.isValid 
              ? "Script executed successfully" 
              : "Script execution failed"),
            variant: newState.isValid ? "default" : "destructive",
          });
        } else if (newState.executionError) {
          toast({
            title: "Execution Stopped",
            description: newState.executionError,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Breakpoint Hit",
            description: "Execution paused at breakpoint",
          });
        }
      } catch (error) {
        setIsRunning(false);
        toast({
          title: "Execution Error",
          description: error instanceof Error ? error.message : "Failed to run script",
          variant: "destructive",
        });
        setIsExecuting(false);
      }
    }, 100);
  }, [scriptState, toast]);

  const handleBreakpointToggle = useCallback((instructionIndex: number) => {
    if (!scriptState) return;
    
    const newState = toggleBreakpoint(scriptState, instructionIndex);
    setScriptState(newState);
    
    toast({
      title: "Breakpoint Toggled",
      description: `Breakpoint ${newState.breakpoints?.has(instructionIndex) ? 'added' : 'removed'} at instruction ${instructionIndex}`,
    });
  }, [scriptState, toast]);

  const executeToNextBreakpointHandler = useCallback(() => {
    if (!scriptState || scriptState.isComplete) return;
    
    // Check if there are any breakpoints ahead
    const nextBreakpointIndex = findNextBreakpoint(scriptState);
    if (nextBreakpointIndex === null) {
      toast({
        title: "No More Breakpoints",
        description: "No breakpoints found ahead. Use 'Run' to execute to completion.",
        variant: "destructive",
      });
      return;
    }
    
    setIsRunning(true);
    
    // Use setTimeout to allow UI to update
    setTimeout(() => {
      try {
        const newState = executeToNextBreakpoint(scriptState);
        setScriptState(newState);
        setIsRunning(false);
        
        if (newState.isComplete) {
          setIsExecuting(false);
          toast({
            title: newState.isValid ? "Script Valid!" : "Script Invalid",
            description: newState.executionError || (newState.isValid 
              ? "Script executed successfully" 
              : "Script execution failed"),
            variant: newState.isValid ? "default" : "destructive",
          });
        } else if (newState.executionError) {
          toast({
            title: "Execution Stopped",
            description: newState.executionError,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Next Breakpoint Reached",
            description: `Stopped at instruction ${newState.currentIndex + 1}`,
          });
        }
      } catch (error) {
        setIsRunning(false);
        toast({
          title: "Execution Error",
          description: error instanceof Error ? error.message : "Failed to execute to next breakpoint",
          variant: "destructive",
        });
        setIsExecuting(false);
      }
    }, 100);
  }, [scriptState, toast]);

  const resetExecution = useCallback(() => {
    setScriptState(null);
    setIsExecuting(false);
    setIsRunning(false);
  }, []);



  const shareScript = useCallback(async () => {
    const shareableUrl = generateShareableUrl(unlockingScript, lockingScript);
    
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
  }, [unlockingScript, lockingScript, toast]);

  // Check if there are any breakpoints set
  const hasBreakpoints = scriptState && (
    (scriptState.breakpoints && scriptState.breakpoints.size > 0) ||
    scriptState.instructions.some(instruction => instruction.opcode === 'OP_NOP69')
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Share Script Button - Top Right */}
      <div className="fixed top-4 right-4 z-10">
        <Button 
          onClick={shareScript}
          variant="outline"
          className="bg-slate-900 border-blue-400 text-blue-400 hover:bg-blue-400 hover:text-slate-900"
          title="Share this script via URL"
        >
          <Share2 size={16} />
        </Button>
      </div>

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
          {/* Initialize Execution - Only show if not initialized */}
          {!scriptState && (
            <Button 
              onClick={initializeExecution} 
              disabled={isExecuting || isRunning}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Initialize Execution
            </Button>
          )}
          
          {/* Reset - Only show if initialized, positioned right after Initialize */}
          {scriptState && (
            <Button 
              onClick={resetExecution} 
              disabled={isRunning}
              variant="outline"
              className="bg-slate-900 border-slate-400 text-slate-400 hover:bg-slate-400 hover:text-slate-900 gap-2"
              title="Reset execution and return to initialization"
            >
              <RotateCcw size={16} />
              Reset
            </Button>
          )}
          
          {/* Execution Controls - Only show when initialized */}
          {scriptState && (
            <>
              <Button 
                onClick={executeNextStep} 
                disabled={scriptState.isComplete || isRunning}
                variant="outline"
                className="bg-slate-900 border-blue-400 text-blue-400 hover:bg-blue-400 hover:text-slate-900"
              >
                Next Step
              </Button>
              <Button 
                onClick={executeRunMode} 
                disabled={scriptState.isComplete || isRunning}
                variant="outline"
                className="bg-slate-900 border-green-400 text-green-400 hover:bg-green-400 hover:text-slate-900 gap-2"
              >
                {isRunning ? <Pause size={16} /> : <Play size={16} />}
                {isRunning ? 'Running...' : 'Run'}
              </Button>
              
              {/* Next Breakpoint - Only show when breakpoints exist */}
              {hasBreakpoints && findNextBreakpoint(scriptState) && (
                <Button 
                  onClick={executeToNextBreakpointHandler} 
                  disabled={scriptState.isComplete || isRunning}
                  variant="outline"
                  className="bg-slate-900 border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-slate-900 gap-2"
                  title="Execute until the next breakpoint"
                >
                  <SkipForward size={16} />
                  Next Breakpoint
                </Button>
              )}
            </>
          )}
          

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
              breakpoints={scriptState.breakpoints}
              onBreakpointToggle={handleBreakpointToggle}
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
