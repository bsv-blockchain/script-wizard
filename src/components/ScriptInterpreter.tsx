
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
  const [unlockingScript, setUnlockingScript] = useState("304402205d8c27451d4ef462264b9f9781999d220fa1a5b9c5a86fabe6f7a31d95f94a5f022034296b82e9582f5b8542fea7d7cf010f84bec76f6f05e74f5c8acaa235f693ec41");
  const [lockingScript, setLockingScript] = useState("026989c55177f4d406f04ebdfb4884452b4cd927337c0b47cdd82c1a10b8b66f0f OP_CHECKSIG");
  const [scriptState, setScriptState] = useState<ScriptState | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column - Script Input */}
      <div className="space-y-6">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-orange-400">Unlocking Script</CardTitle>
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
            <CardTitle className="text-orange-400">Locking Script</CardTitle>
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

        <div className="flex gap-3 flex-wrap">
          <Button 
            onClick={initializeExecution} 
            disabled={isExecuting}
            className="bg-orange-600 hover:bg-orange-700"
          >
            Initialize Execution
          </Button>
          <Button 
            onClick={executeNextStep} 
            disabled={!scriptState || scriptState.isComplete}
            variant="outline"
            className="border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-slate-900"
          >
            Next Step
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
