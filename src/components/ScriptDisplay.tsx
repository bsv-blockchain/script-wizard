
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScriptInstruction } from "@/utils/scriptUtils";

interface ScriptDisplayProps {
  instructions: ScriptInstruction[];
  currentIndex: number;
  unlockingScriptLength: number;
}

const ScriptDisplay: React.FC<ScriptDisplayProps> = ({ 
  instructions, 
  currentIndex, 
  unlockingScriptLength 
}) => {
  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className="text-orange-400">Script Execution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {instructions.map((instruction, index) => {
            const isUnlockingScript = index < unlockingScriptLength;
            const isCurrent = index === currentIndex;
            const isExecuted = index < currentIndex;
            
            return (
              <div
                key={index}
                className={`
                  p-2 rounded font-mono text-sm transition-all duration-300
                  ${isCurrent 
                    ? 'bg-orange-600/30 border border-orange-500 text-orange-200' 
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
                        : 'bg-blue-600/20 text-blue-400'
                      }
                    `}>
                      {isUnlockingScript ? 'UNLOCK' : 'LOCK'}
                    </span>
                    <span>{instruction.opcode}</span>
                    {instruction.data && (
                      <span className="text-yellow-400">
                        [{instruction.data}]
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-slate-500">
                    {index + 1}/{instructions.length}
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
