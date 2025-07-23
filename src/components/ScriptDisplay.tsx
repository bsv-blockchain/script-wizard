
import React, { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Circle } from "lucide-react";
import { ScriptInstruction } from "@/utils/scriptUtils";

interface ScriptDisplayProps {
  instructions: ScriptInstruction[];
  currentIndex: number;
  unlockingScriptLength: number;
  breakpoints: number[];
  onToggleBreakpoint: (index: number) => void;
}

const ScriptDisplay: React.FC<ScriptDisplayProps> = ({
  instructions,
  currentIndex,
  unlockingScriptLength,
  breakpoints,
  onToggleBreakpoint
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const currentInstructionRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to keep current instruction at bottom of visible area
  useEffect(() => {
    if (currentInstructionRef.current && currentIndex >= 0) {
      // Use scrollIntoView to position the element at the bottom of the container
      currentInstructionRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'end', // Positions the element at the bottom of the visible area
        inline: 'nearest'
      });
    }
  }, [currentIndex]);

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className="text-gray-400">Script Execution</CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={containerRef} className="space-y-1 max-h-64 overflow-y-auto">
          {instructions.map((instruction, index) => {
            const isUnlockingScript = index < unlockingScriptLength;
            const isCurrent = index === currentIndex;
            const isExecuted = index < currentIndex;
            const hasBreakpoint = breakpoints.includes(index);
            
            return (
              <div
                key={index}
                ref={isCurrent ? currentInstructionRef : null}
                className={`
                  p-2 rounded font-mono text-sm transition-all duration-300
                  ${isCurrent 
                    ? 'bg-blue-600/30 border border-blue-500 text-blue-200' 
                    : isExecuted
                    ? 'bg-slate-700/50 border border-slate-600 text-slate-400'
                    : 'bg-slate-900 border border-slate-700 text-slate-300'
                  }
                `}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className={`
                      text-xs px-2 py-1 rounded
                      ${isUnlockingScript 
                        ? 'bg-green-600/20 text-green-400' 
                        : 'bg-red-600/20 text-red-400'
                      }
                    `}>
                      {isUnlockingScript ? 'UNLOCK' : 'LOCK'}
                    </span>
                    <span>{instruction.opcode}</span>
                    {instruction.data && (
                      <span className="text-slate-400">
                        [{instruction.data}]
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    <button
                      onClick={() => onToggleBreakpoint(index)}
                      className="p-0 m-0"
                    >
                      <Circle
                        size={12}
                        className={hasBreakpoint ? 'text-red-500 fill-red-500' : 'text-slate-500'}
                      />
                    </button>
                    <span className="text-xs text-slate-500">
                      {index + 1}/{instructions.length}
                    </span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default ScriptDisplay;
