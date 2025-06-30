
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StackVisualizerProps {
  stack: string[];
  altStack: string[];
}

const StackVisualizer: React.FC<StackVisualizerProps> = ({ stack, altStack }) => {
  const renderStack = (stackData: string[], title: string, color: string) => (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className={`text-${color}-400 text-lg`}>
          {title} ({stackData.length} items)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 min-h-32">
          {stackData.length === 0 ? (
            <div className="text-slate-500 italic text-center py-4">Empty</div>
          ) : (
            stackData.map((item, index) => (
              <div
                key={`${title}-${index}-${item}`}
                className={`
                  p-3 rounded font-mono text-sm
                  ${index === stackData.length - 1 
                    ? `bg-${color}-600/20 border border-${color}-500/50 text-${color}-300` 
                    : 'bg-slate-700 border border-slate-600 text-slate-300'
                  }
                  transition-all duration-300 ease-in-out
                `}
                style={{
                  transform: `translateY(${index === stackData.length - 1 ? '0' : '0'})`,
                }}
              >
                <div className="flex justify-between items-center">
                  <span>{item}</span>
                  <span className="text-xs text-slate-500">
                    [{stackData.length - 1 - index}]
                  </span>
                </div>
              </div>
            )).reverse()
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {renderStack(stack, "Main Stack", "green")}
      {renderStack(altStack, "Alt Stack", "purple")}
    </div>
  );
};

export default StackVisualizer;
