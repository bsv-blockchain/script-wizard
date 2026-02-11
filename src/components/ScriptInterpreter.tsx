
import { useState, useCallback, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StackVisualizer from "./StackVisualizer";
import ScriptDisplay from "./ScriptDisplay";
import { parseScript, executeStep, executeRun, executeToNextBreakpoint, toggleBreakpoint, findNextBreakpoint, ScriptState } from "@/utils/scriptUtils";
import { Transaction, UnlockingScript, LockingScript } from "@bsv/sdk";
import { parseScriptParamsFromUrl, generateShareableUrl, updateUrlWithScripts, ScriptParams } from "@/utils/urlUtils";
import { useToast } from "@/hooks/use-toast";
import { Share2, Play, Pause, SkipForward, RotateCcw, Loader2, X } from "lucide-react";
import { enrich } from "@/lib/utils";
import { woc } from "@/lib/woc";

interface ScriptInterpreterProps {
  onExecutionStateChange?: (isExecuting: boolean) => void;
}

const ScriptInterpreter = ({ onExecutionStateChange }: ScriptInterpreterProps = {}) => {
  const [unlockingScript, setUnlockingScript] = useState("");
  const [lockingScript, setLockingScript] = useState("");
  const [scriptState, setScriptState] = useState<ScriptState | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [transactionVersion, setTransactionVersion] = useState(2);
  const [beefHex, setBeefHex] = useState("");
  const [beefTx, setBeefTx] = useState<Transaction | null>(null);
  const [beefInputIndex, setBeefInputIndex] = useState(0);
  const [beefError, setBeefError] = useState("");
  const [lookupTxid, setLookupTxid] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [network, setNetwork] = useState("main");

  const { toast } = useToast();

  // Load scripts from URL parameters on component mount
  useEffect(() => {
    const urlParams: ScriptParams = parseScriptParamsFromUrl();
    const vin = urlParams.vin ?? 0;

    if (urlParams.txid) {
      setLookupTxid(urlParams.txid);
      setBeefInputIndex(vin);
      // Fetch BEEF from chain
      (async () => {
        setLookupLoading(true);
        try {
          const hex = await woc.getBeef(urlParams.txid!);
          setBeefHex(hex);
          const tx = Transaction.fromHexBEEF(hex);
          setBeefTx(tx);
          await populateFromBeef(tx, vin);
        } catch (e) {
          setBeefError(e instanceof Error ? e.message : "Failed to fetch BEEF for TXID");
        } finally {
          setLookupLoading(false);
        }
      })();
    } else if (urlParams.beef) {
      setBeefHex(urlParams.beef);
      setBeefInputIndex(vin);
      (async () => {
        try {
          const tx = Transaction.fromHexBEEF(urlParams.beef!);
          setBeefTx(tx);
          await populateFromBeef(tx, vin);
        } catch (e) {
          setBeefError(e instanceof Error ? e.message : "Invalid BEEF hex");
        }
      })();
    } else {
      if (urlParams.unlock) setUnlockingScript(urlParams.unlock);
      if (urlParams.lock) setLockingScript(urlParams.lock);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Populate script textareas from a parsed BEEF transaction at the given input index
  const populateFromBeef = useCallback(async (tx: Transaction, inputIdx: number) => {
    const input = tx.inputs[inputIdx];
    console.log({ input })
    if (!input.sourceTransaction) {
      await enrich(input)
    }
    const sourceOutput = input.sourceTransaction!.outputs![input.sourceOutputIndex];
    setUnlockingScript(input.unlockingScript!.toASM());
    setLockingScript(sourceOutput.lockingScript!.toASM());
    setTransactionVersion(tx.version);
  }, []);

  // Handle BEEF hex input changes
  const handleBeefHexChange = useCallback(async (hex: string) => {
    setBeefHex(hex);
    const trimmed = hex.trim();
    if (!trimmed) {
      setBeefTx(null);
      setBeefError("");
      setBeefInputIndex(0);
      return;
    }
    try {
      const tx = Transaction.fromHexBEEF(trimmed);
      setBeefTx(tx);
      setBeefError("");
      setBeefInputIndex(0);
      await populateFromBeef(tx, 0);
    } catch (e) {
      setBeefTx(null);
      setBeefError(e instanceof Error ? e.message : "Invalid BEEF hex");
    }
  }, [populateFromBeef]);

  // Handle input index change for BEEF mode
  const handleBeefInputIndexChange = useCallback(async (value: string) => {
    const idx = parseInt(value, 10);
    setBeefInputIndex(idx);
    if (beefTx) {
      await populateFromBeef(beefTx, idx);
    }
  }, [beefTx, populateFromBeef]);

  // Handle network change
  const handleNetworkChange = useCallback((value: string) => {
    setNetwork(value);
    woc.setNetwork(value);
  }, []);

  // Fetch BEEF from chain by TXID
  const handleTxidLookup = useCallback(async () => {
    const trimmed = lookupTxid.trim();
    if (!trimmed) return;
    setLookupLoading(true);
    setBeefError("");
    try {
      const hex = await woc.getBeef(trimmed);
      setBeefHex(hex);
      const tx = Transaction.fromHexBEEF(hex);
      setBeefTx(tx);
      setBeefInputIndex(0);
      await populateFromBeef(tx, 0);
    } catch (e) {
      setBeefTx(null);
      setBeefError(e instanceof Error ? e.message : "Failed to fetch BEEF for TXID");
    } finally {
      setLookupLoading(false);
    }
  }, [lookupTxid, populateFromBeef]);

  // Clear all BEEF, TXID, and script state
  const clearAll = useCallback(() => {
    setLookupTxid("");
    setBeefHex("");
    setBeefTx(null);
    setBeefInputIndex(0);
    setBeefError("");
    setUnlockingScript("");
    setLockingScript("");
    setTransactionVersion(2);
  }, []);

  // When BEEF is loaded and user edits a script textarea, update the in-memory tx object
  const handleUnlockingScriptChange = useCallback((value: string) => {
    setUnlockingScript(value);
    if (beefTx) {
      try {
        beefTx.inputs[beefInputIndex].unlockingScript = UnlockingScript.fromASM(value);
      } catch { /* ignore parse errors during editing */ }
    }
  }, [beefTx, beefInputIndex]);

  const handleLockingScriptChange = useCallback((value: string) => {
    setLockingScript(value);
    if (beefTx) {
      try {
        const input = beefTx.inputs[beefInputIndex];
        input.sourceTransaction!.outputs![input.sourceOutputIndex].lockingScript = LockingScript.fromASM(value);
      } catch { /* ignore parse errors during editing */ }
    }
  }, [beefTx, beefInputIndex]);

  // Update URL when relevant state changes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      updateUrlWithScripts({
        lookupTxid: lookupTxid && beefTx ? lookupTxid : undefined,
        beefHex: !lookupTxid && beefHex ? beefHex : undefined,
        beefInputIndex,
        unlockingScript,
        lockingScript,
      });
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [unlockingScript, lockingScript, lookupTxid, beefHex, beefTx, beefInputIndex]);

  // Notify parent when execution state changes
  useEffect(() => {
    onExecutionStateChange?.(scriptState !== null);
  }, [scriptState, onExecutionStateChange]);

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
        context: 'UnlockingScript' as const,
        transactionVersion,
        beefTx: beefTx ?? undefined,
        beefInputIndex: beefTx ? beefInputIndex : undefined,
      };
      
      setScriptState(initialState);
      setIsExecuting(true);
      
      toast({
        title: "Script Initialized",
        description: `Ready to execute ${combinedInstructions.length} instructions`,
      });
    } catch (error) {
      console.error("Failed to parse script:", error);
      toast({
        title: "Parse Error",
        description: error instanceof Error ? error.message : "Failed to parse script",
        variant: "destructive",
      });
    }
  }, [unlockingScript, lockingScript, transactionVersion, beefTx, beefInputIndex, toast]);

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
      console.error("Failed to execute instruction:", error);
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
        console.error("Failed to run script:", error);
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
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Failed to execute to next breakpoint";
        console.error("Failed to execute to next breakpoint:", e);
        setIsRunning(false);
        toast({
          title: "Execution Error",
          description: message,
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
    const shareableUrl = generateShareableUrl({
      lookupTxid: lookupTxid && beefTx ? lookupTxid : undefined,
      beefHex: !lookupTxid && beefHex ? beefHex : undefined,
      beefInputIndex,
      unlockingScript,
      lockingScript,
    });

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
  }, [unlockingScript, lockingScript, lookupTxid, beefHex, beefTx, beefInputIndex, toast]);

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
        {/* Control Buttons - Always at the top */}
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

        {/* Only show script input areas when not executing */}
        {!scriptState && (
          <>
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-gray-400">BEEF Transaction (Optional)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Select value={network} onValueChange={handleNetworkChange}>
                    <SelectTrigger className="w-24 bg-slate-900 border-slate-600 text-yellow-400">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="main">main</SelectItem>
                      <SelectItem value="test">test</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={lookupTxid}
                    onChange={(e) => setLookupTxid(e.target.value)}
                    placeholder="Paste TXID to fetch BEEF from chain"
                    className="font-mono bg-slate-900 border-slate-600 text-yellow-400 text-xs flex-1"
                    disabled={isExecuting || lookupLoading}
                  />
                  <Button
                    onClick={handleTxidLookup}
                    disabled={isExecuting || lookupLoading || !lookupTxid.trim()}
                    variant="outline"
                    className="bg-slate-900 border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-slate-900"
                  >
                    {lookupLoading ? <Loader2 size={16} className="animate-spin" /> : "Fetch"}
                  </Button>
                  <Button
                    onClick={clearAll}
                    disabled={isExecuting || lookupLoading}
                    variant="outline"
                    className="bg-slate-900 border-slate-400 text-slate-400 hover:bg-slate-400 hover:text-slate-900"
                    title="Clear all"
                  >
                    <X size={16} />
                  </Button>
                </div>
                <Textarea
                  value={beefHex}
                  onChange={async (e) => await handleBeefHexChange(e.target.value)}
                  placeholder="Or paste BEEF hex directly"
                  className="font-mono bg-slate-900 border-slate-600 text-yellow-400 min-h-20 text-xs"
                  disabled={isExecuting}
                />
                {beefError && (
                  <p className="text-red-400 text-sm">{beefError}</p>
                )}
                {beefTx && (
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-sm">Input Index:</span>
                    <Select value={String(beefInputIndex)} onValueChange={handleBeefInputIndexChange}>
                      <SelectTrigger className="w-40 bg-slate-900 border-slate-600 text-yellow-400">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {beefTx.inputs.map((_, i) => (
                          <SelectItem key={i} value={String(i)}>Input {i}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-green-400 text-sm">Parsed OK — {beefTx.inputs.length} input(s)</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-gray-400">Unlocking Script</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={unlockingScript}
                  onChange={(e) => handleUnlockingScriptChange(e.target.value)}
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
                  onChange={(e) => handleLockingScriptChange(e.target.value)}
                  placeholder="Enter locking script&#10;Example:&#10;OP_ADD&#10;OP_3&#10;OP_EQUAL"
                  className="font-mono bg-slate-900 border-slate-600 text-red-400 min-h-32"
                  disabled={isExecuting}
                />
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-gray-400">Transaction Version</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  type="number"
                  min={0}
                  max={4294967295}
                  value={transactionVersion}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (Number.isInteger(val) && val >= 0 && val <= 4294967295) {
                      setTransactionVersion(val);
                    }
                  }}
                  className="font-mono bg-slate-900 border-slate-600 text-blue-400 w-48"
                  disabled={isExecuting}
                />
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Right Column - Execution Visualization / Help */}
      <div className="space-y-6">
        {scriptState ? (
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
        ) : (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-gray-400">Getting Started</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-300">
              <div>
                <h3 className="text-blue-400 font-semibold mb-1">Load a Transaction</h3>
                <p>Paste a <span className="text-yellow-400">TXID</span> and click <span className="text-yellow-400">Fetch</span> to load a confirmed transaction from the blockchain. Select the network (main/test) and choose which input to debug. You can also paste raw <span className="text-yellow-400">BEEF hex</span> directly for off-chain transactions.</p>
              </div>
              <Separator className="bg-slate-700" />
              <div>
                <h3 className="text-blue-400 font-semibold mb-1">Write Scripts Manually</h3>
                <p>Enter an <span className="text-green-400">unlocking script</span> and a <span className="text-red-400">locking script</span> using opcodes (e.g. <code className="text-slate-400">OP_DUP OP_HASH160</code>) or hex data. Scripts are executed in sequence: unlocking first, then locking.</p>
              </div>
              <Separator className="bg-slate-700" />
              <div>
                <h3 className="text-blue-400 font-semibold mb-1">Debug Execution</h3>
                <p>Click <span className="text-blue-400">Initialize Execution</span> to begin. Then use <span className="text-blue-400">Next Step</span> to advance one opcode at a time, or <span className="text-green-400">Run</span> to execute to completion. The stack and script position update in real time.</p>
              </div>
              <Separator className="bg-slate-700" />
              <div>
                <h3 className="text-blue-400 font-semibold mb-1">Breakpoints</h3>
                <p>Click any instruction during execution to toggle a breakpoint. Use <span className="text-orange-400">Next Breakpoint</span> to skip ahead. <code className="text-slate-400">OP_NOP69</code> acts as an inline breakpoint marker.</p>
              </div>
              <Separator className="bg-slate-700" />
              <div>
                <h3 className="text-blue-400 font-semibold mb-1">Signature Verification</h3>
                <p>When a transaction is loaded via TXID or BEEF, <code className="text-slate-400">OP_CHECKSIG</code> and <code className="text-slate-400">OP_CHECKMULTISIG</code> perform real ECDSA verification against the transaction data. In manual mode they always return true.</p>
              </div>
              <Separator className="bg-slate-700" />
              <div>
                <h3 className="text-blue-400 font-semibold mb-1">Share</h3>
                <p>Click the <span className="text-blue-400">share</span> button to copy a URL that restores your current scripts or transaction. TXIDs produce compact links; pasted BEEF is encoded in the URL directly.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ScriptInterpreter;
